-- Add missing DELETE RLS policy for body_measurements
-- Previously only SELECT, INSERT, UPDATE were allowed; DELETE was missing
CREATE POLICY "Users can delete own measurements"
    ON public.body_measurements FOR DELETE
    USING (auth.uid() = user_id);
