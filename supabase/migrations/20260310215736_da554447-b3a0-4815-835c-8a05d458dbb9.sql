
-- Allow doctors to read medications of their linked patients
CREATE POLICY "med_select_doctor"
ON public.medications
FOR SELECT
TO authenticated
USING (
  user_id IN (
    SELECT dpl.patient_user_id
    FROM doctor_patient_links dpl
    WHERE dpl.doctor_user_id = auth.uid()
      AND dpl.status = 'active'
  )
);

-- Allow doctors to read medication_tracking of their linked patients
CREATE POLICY "mt_select_doctor"
ON public.medication_tracking
FOR SELECT
TO authenticated
USING (
  user_id IN (
    SELECT dpl.patient_user_id
    FROM doctor_patient_links dpl
    WHERE dpl.doctor_user_id = auth.uid()
      AND dpl.status = 'active'
  )
);
