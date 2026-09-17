-- ROLLBACK proposed for B2 — restore TO public (default)
-- Count: 13

DROP POLICY IF EXISTS 'service role deletes ai logs' ON public."ai_processing_logs";
CREATE POLICY 'service role deletes ai logs'
  ON public."ai_processing_logs"
  AS PERMISSIVE
  FOR DELETE
  USING ((auth.role() = 'service_role'::text))
;

DROP POLICY IF EXISTS 'service role inserts ai logs' ON public."ai_processing_logs";
CREATE POLICY 'service role inserts ai logs'
  ON public."ai_processing_logs"
  AS PERMISSIVE
  FOR INSERT
  WITH CHECK ((auth.role() = 'service_role'::text))
;

DROP POLICY IF EXISTS 'Service role can insert send log' ON public."email_send_log";
CREATE POLICY 'Service role can insert send log'
  ON public."email_send_log"
  AS PERMISSIVE
  FOR INSERT
  WITH CHECK ((auth.role() = 'service_role'::text))
;

DROP POLICY IF EXISTS 'Service role can read send log' ON public."email_send_log";
CREATE POLICY 'Service role can read send log'
  ON public."email_send_log"
  AS PERMISSIVE
  FOR SELECT
  USING ((auth.role() = 'service_role'::text))
;

DROP POLICY IF EXISTS 'Service role can update send log' ON public."email_send_log";
CREATE POLICY 'Service role can update send log'
  ON public."email_send_log"
  AS PERMISSIVE
  FOR UPDATE
  USING ((auth.role() = 'service_role'::text))
  WITH CHECK ((auth.role() = 'service_role'::text))
;

DROP POLICY IF EXISTS 'Service role can manage send state' ON public."email_send_state";
CREATE POLICY 'Service role can manage send state'
  ON public."email_send_state"
  AS PERMISSIVE
  FOR ALL
  USING ((auth.role() = 'service_role'::text))
  WITH CHECK ((auth.role() = 'service_role'::text))
;

DROP POLICY IF EXISTS 'Service role can insert tokens' ON public."email_unsubscribe_tokens";
CREATE POLICY 'Service role can insert tokens'
  ON public."email_unsubscribe_tokens"
  AS PERMISSIVE
  FOR INSERT
  WITH CHECK ((auth.role() = 'service_role'::text))
;

DROP POLICY IF EXISTS 'Service role can mark tokens as used' ON public."email_unsubscribe_tokens";
CREATE POLICY 'Service role can mark tokens as used'
  ON public."email_unsubscribe_tokens"
  AS PERMISSIVE
  FOR UPDATE
  USING ((auth.role() = 'service_role'::text))
  WITH CHECK ((auth.role() = 'service_role'::text))
;

DROP POLICY IF EXISTS 'Service role can read tokens' ON public."email_unsubscribe_tokens";
CREATE POLICY 'Service role can read tokens'
  ON public."email_unsubscribe_tokens"
  AS PERMISSIVE
  FOR SELECT
  USING ((auth.role() = 'service_role'::text))
;

DROP POLICY IF EXISTS 'service role manages queue' ON public."homework_generation_queue";
CREATE POLICY 'service role manages queue'
  ON public."homework_generation_queue"
  AS PERMISSIVE
  FOR ALL
  USING ((auth.role() = 'service_role'::text))
  WITH CHECK ((auth.role() = 'service_role'::text))
;

DROP POLICY IF EXISTS 'Service role can insert suppressed emails' ON public."suppressed_emails";
CREATE POLICY 'Service role can insert suppressed emails'
  ON public."suppressed_emails"
  AS PERMISSIVE
  FOR INSERT
  WITH CHECK ((auth.role() = 'service_role'::text))
;

DROP POLICY IF EXISTS 'Service role can read suppressed emails' ON public."suppressed_emails";
CREATE POLICY 'Service role can read suppressed emails'
  ON public."suppressed_emails"
  AS PERMISSIVE
  FOR SELECT
  USING ((auth.role() = 'service_role'::text))
;

DROP POLICY IF EXISTS 'Service role manages sync_log' ON public."sync_log";
CREATE POLICY 'Service role manages sync_log'
  ON public."sync_log"
  AS PERMISSIVE
  FOR ALL
  USING ((auth.role() = 'service_role'::text))
  WITH CHECK ((auth.role() = 'service_role'::text))
;
