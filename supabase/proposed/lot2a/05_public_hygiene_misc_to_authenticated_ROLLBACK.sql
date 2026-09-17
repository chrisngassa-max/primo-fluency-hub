-- ROLLBACK proposed for B4 — restore TO public (default)
-- Count: 1

DROP POLICY IF EXISTS 'no update ai logs' ON public."ai_processing_logs";
CREATE POLICY 'no update ai logs'
  ON public."ai_processing_logs"
  AS PERMISSIVE
  FOR UPDATE
  USING (false)
;
