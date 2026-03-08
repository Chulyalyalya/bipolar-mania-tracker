ALTER TABLE public.entries 
  ADD COLUMN IF NOT EXISTS entered_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_edited_at timestamptz;