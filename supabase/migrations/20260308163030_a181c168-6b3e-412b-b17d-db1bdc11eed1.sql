
-- Attach the existing trigger function to user_roles table
-- This ensures doctor_code is generated exactly once when a doctor role is assigned
CREATE OR REPLACE TRIGGER on_doctor_role_assigned
  AFTER INSERT ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_doctor_role_assigned();
