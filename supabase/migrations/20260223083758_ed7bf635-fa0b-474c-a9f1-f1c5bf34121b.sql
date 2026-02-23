
-- 1. Enums
CREATE TYPE public.app_role AS ENUM ('doctor', 'patient');
CREATE TYPE public.link_status AS ENUM ('pending', 'active', 'revoked');

-- 2. User roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Security definer function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- 4. RLS on user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own role" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- 5. Alter profiles
ALTER TABLE public.profiles
  ADD COLUMN doctor_code text UNIQUE,
  ADD COLUMN updated_at timestamptz DEFAULT now();

-- 6. Doctor-patient links (BEFORE profiles policy that references it)
CREATE TABLE public.doctor_patient_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status link_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (doctor_user_id, patient_user_id)
);
ALTER TABLE public.doctor_patient_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Doctors read own links" ON public.doctor_patient_links FOR SELECT TO authenticated USING (doctor_user_id = auth.uid());
CREATE POLICY "Patients read own links" ON public.doctor_patient_links FOR SELECT TO authenticated USING (patient_user_id = auth.uid());
CREATE POLICY "Patients create links" ON public.doctor_patient_links FOR INSERT TO authenticated WITH CHECK (patient_user_id = auth.uid());
CREATE POLICY "Patients update own links" ON public.doctor_patient_links FOR UPDATE TO authenticated USING (patient_user_id = auth.uid());

-- 7. Now update profiles RLS
DROP POLICY IF EXISTS "Profiles are viewable by owner" ON public.profiles;
CREATE POLICY "Profiles viewable by owner or linked doctor" ON public.profiles FOR SELECT TO authenticated
  USING (
    auth.uid() = id
    OR (
      public.has_role(auth.uid(), 'doctor')
      AND EXISTS (
        SELECT 1 FROM public.doctor_patient_links
        WHERE doctor_user_id = auth.uid() AND patient_user_id = profiles.id AND status = 'active'
      )
    )
  );

-- 8. Entries
CREATE TABLE public.entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, entry_date)
);
ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own entries" ON public.entries FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Doctors read linked patient entries" ON public.entries FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'doctor') AND EXISTS (
    SELECT 1 FROM public.doctor_patient_links WHERE doctor_user_id = auth.uid() AND patient_user_id = entries.user_id AND status = 'active'
  ));

-- 9. Mania answers
CREATE TABLE public.mania_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES public.entries(id) ON DELETE CASCADE,
  block_id smallint NOT NULL CHECK (block_id BETWEEN 1 AND 7),
  question_id smallint NOT NULL,
  score smallint NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 4)
);
ALTER TABLE public.mania_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own mania_answers" ON public.mania_answers FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.entries WHERE id = mania_answers.entry_id AND user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.entries WHERE id = mania_answers.entry_id AND user_id = auth.uid()));
CREATE POLICY "Doctors read linked mania_answers" ON public.mania_answers FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'doctor') AND EXISTS (
    SELECT 1 FROM public.entries e JOIN public.doctor_patient_links l ON l.patient_user_id = e.user_id AND l.doctor_user_id = auth.uid() AND l.status = 'active' WHERE e.id = mania_answers.entry_id
  ));

-- 10. IPSRT anchors
CREATE TABLE public.ipsrt_anchors (
  entry_id uuid PRIMARY KEY REFERENCES public.entries(id) ON DELETE CASCADE,
  bedtime time, wake_time time, first_meal_time time, last_meal_time time, main_social_anchor_time time
);
ALTER TABLE public.ipsrt_anchors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own ipsrt_anchors" ON public.ipsrt_anchors FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.entries WHERE id = ipsrt_anchors.entry_id AND user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.entries WHERE id = ipsrt_anchors.entry_id AND user_id = auth.uid()));
CREATE POLICY "Doctors read linked ipsrt_anchors" ON public.ipsrt_anchors FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'doctor') AND EXISTS (
    SELECT 1 FROM public.entries e JOIN public.doctor_patient_links l ON l.patient_user_id = e.user_id AND l.doctor_user_id = auth.uid() AND l.status = 'active' WHERE e.id = ipsrt_anchors.entry_id
  ));

-- 11. IPSRT ratings
CREATE TABLE public.ipsrt_ratings (
  entry_id uuid PRIMARY KEY REFERENCES public.entries(id) ON DELETE CASCADE,
  rating_q1 smallint DEFAULT 0 CHECK (rating_q1 BETWEEN 0 AND 4),
  rating_q2 smallint DEFAULT 0 CHECK (rating_q2 BETWEEN 0 AND 4),
  rating_q3 smallint DEFAULT 0 CHECK (rating_q3 BETWEEN 0 AND 4),
  rating_q4 smallint DEFAULT 0 CHECK (rating_q4 BETWEEN 0 AND 4),
  rhythm_stability_score smallint DEFAULT 0 CHECK (rhythm_stability_score BETWEEN 0 AND 100)
);
ALTER TABLE public.ipsrt_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own ipsrt_ratings" ON public.ipsrt_ratings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.entries WHERE id = ipsrt_ratings.entry_id AND user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.entries WHERE id = ipsrt_ratings.entry_id AND user_id = auth.uid()));
CREATE POLICY "Doctors read linked ipsrt_ratings" ON public.ipsrt_ratings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'doctor') AND EXISTS (
    SELECT 1 FROM public.entries e JOIN public.doctor_patient_links l ON l.patient_user_id = e.user_id AND l.doctor_user_id = auth.uid() AND l.status = 'active' WHERE e.id = ipsrt_ratings.entry_id
  ));

-- 12. Entry summaries
CREATE TABLE public.entry_summaries (
  entry_id uuid PRIMARY KEY REFERENCES public.entries(id) ON DELETE CASCADE,
  block1_sum smallint DEFAULT 0, block2_sum smallint DEFAULT 0, block3_sum smallint DEFAULT 0,
  block4_sum smallint DEFAULT 0, block5_sum smallint DEFAULT 0, block6_sum smallint DEFAULT 0,
  block7_sum smallint DEFAULT 0, total_risk_blocks_count smallint DEFAULT 0,
  sustained_activation boolean DEFAULT false, high_risk_sleep boolean DEFAULT false
);
ALTER TABLE public.entry_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own entry_summaries" ON public.entry_summaries FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.entries WHERE id = entry_summaries.entry_id AND user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.entries WHERE id = entry_summaries.entry_id AND user_id = auth.uid()));
CREATE POLICY "Doctors read linked entry_summaries" ON public.entry_summaries FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'doctor') AND EXISTS (
    SELECT 1 FROM public.entries e JOIN public.doctor_patient_links l ON l.patient_user_id = e.user_id AND l.doctor_user_id = auth.uid() AND l.status = 'active' WHERE e.id = entry_summaries.entry_id
  ));

-- 13. Trigger: auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name) VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name');
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 14. Doctor code generation
CREATE OR REPLACE FUNCTION public.generate_doctor_code()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_code text; chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'; i int;
BEGIN
  LOOP
    new_code := '';
    FOR i IN 1..9 LOOP new_code := new_code || substr(chars, floor(random() * 36 + 1)::int, 1); END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE doctor_code = new_code);
  END LOOP;
  RETURN new_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_doctor_role_assigned()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role = 'doctor' THEN
    UPDATE public.profiles SET doctor_code = public.generate_doctor_code() WHERE id = NEW.user_id AND doctor_code IS NULL;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_doctor_role_assigned AFTER INSERT ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.handle_doctor_role_assigned();

-- 15. Updated_at triggers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER update_entries_updated_at BEFORE UPDATE ON public.entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_doctor_patient_links_updated_at BEFORE UPDATE ON public.doctor_patient_links FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
