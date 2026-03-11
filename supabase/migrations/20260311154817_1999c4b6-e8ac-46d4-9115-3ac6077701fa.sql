-- Allow users to delete their own mania_answers
CREATE POLICY "mania_answers_delete_own" ON public.mania_answers
FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM entries e
  WHERE e.id = mania_answers.entry_id AND e.user_id = auth.uid()
));