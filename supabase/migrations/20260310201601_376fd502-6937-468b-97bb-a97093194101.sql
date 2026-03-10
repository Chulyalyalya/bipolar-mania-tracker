
-- Allow doctors to SELECT their own links
CREATE POLICY "dpl_select_own_doctor"
ON public.doctor_patient_links
FOR SELECT
TO authenticated
USING (doctor_user_id = auth.uid());

-- Allow doctors to read profiles of their linked patients
CREATE POLICY "profiles_select_linked_patient"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT patient_user_id FROM public.doctor_patient_links
    WHERE doctor_user_id = auth.uid() AND status = 'active'
  )
);

-- Allow doctors to read entries of their linked patients
CREATE POLICY "entries_select_doctor"
ON public.entries
FOR SELECT
TO authenticated
USING (
  user_id IN (
    SELECT patient_user_id FROM public.doctor_patient_links
    WHERE doctor_user_id = auth.uid() AND status = 'active'
  )
);

-- Allow doctors to read mania_answers of their linked patients
CREATE POLICY "mania_answers_select_doctor"
ON public.mania_answers
FOR SELECT
TO authenticated
USING (
  entry_id IN (
    SELECT e.id FROM public.entries e
    JOIN public.doctor_patient_links dpl ON dpl.patient_user_id = e.user_id
    WHERE dpl.doctor_user_id = auth.uid() AND dpl.status = 'active'
  )
);

-- Allow patients to look up doctor profiles by doctor_code (for connecting)
CREATE POLICY "profiles_select_doctor_by_code"
ON public.profiles
FOR SELECT
TO authenticated
USING (doctor_code IS NOT NULL);
