-- Allow authenticated users to find doctors by their doctor_code
CREATE POLICY "Anyone can find doctors by code"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (doctor_code IS NOT NULL);
