
-- Table: medication_tracking
CREATE TABLE public.medication_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  morning_taken boolean NOT NULL DEFAULT false,
  evening_taken boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, entry_date)
);

ALTER TABLE public.medication_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mt_select_own" ON public.medication_tracking FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "mt_insert_own" ON public.medication_tracking FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "mt_update_own" ON public.medication_tracking FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "mt_delete_own" ON public.medication_tracking FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Table: medications
CREATE TABLE public.medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period text NOT NULL CHECK (period IN ('morning', 'evening')),
  medication_name text NOT NULL,
  dosage text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "med_select_own" ON public.medications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "med_insert_own" ON public.medications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "med_update_own" ON public.medications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "med_delete_own" ON public.medications FOR DELETE TO authenticated USING (auth.uid() = user_id);
