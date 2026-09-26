-- =============================================================================
-- CAPTCF LOT 2A — PROPOSED (NOT APPLIED) — B2 service-destined {public} → TO service_role
-- Generated from CAPTCF_LOT_02A_POLICIES_INVENTORY.json
-- Count: 13
-- Target role clause: TO service_role
-- DO NOT place under supabase/migrations/ until owner-authorized.
-- =============================================================================
-- Policies named/checked for service_role but still attached to PUBLIC.

-- class=destinee_service_role table=ai_processing_logs
DROP POLICY IF EXISTS 'service role deletes ai logs' ON public."ai_processing_logs";
CREATE POLICY 'service role deletes ai logs'
  ON public."ai_processing_logs"
  AS PERMISSIVE
  FOR DELETE
  TO service_role
  USING ((auth.role() = 'service_role'::text))
;

-- class=destinee_service_role table=ai_processing_logs
DROP POLICY IF EXISTS 'service role inserts ai logs' ON public."ai_processing_logs";
CREATE POLICY 'service role inserts ai logs'
  ON public."ai_processing_logs"
  AS PERMISSIVE
  FOR INSERT
  TO service_role
  WITH CHECK ((auth.role() = 'service_role'::text))
;

-- class=destinee_service_role table=email_send_log
DROP POLICY IF EXISTS 'Service role can insert send log' ON public."email_send_log";
CREATE POLICY 'Service role can insert send log'
  ON public."email_send_log"
  AS PERMISSIVE
  FOR INSERT
  TO service_role
  WITH CHECK ((auth.role() = 'service_role'::text))
;

-- class=destinee_service_role table=email_send_log
DROP POLICY IF EXISTS 'Service role can read send log' ON public."email_send_log";
CREATE POLICY 'Service role can read send log'
  ON public."email_send_log"
  AS PERMISSIVE
  FOR SELECT
  TO service_role
  USING ((auth.role() = 'service_role'::text))
;

-- class=destinee_service_role table=email_send_log
DROP POLICY IF EXISTS 'Service role can update send log' ON public."email_send_log";
CREATE POLICY 'Service role can update send log'
  ON public."email_send_log"
  AS PERMISSIVE
  FOR UPDATE
  TO service_role
  USING ((auth.role() = 'service_role'::text))
  WITH CHECK ((auth.role() = 'service_role'::text))
;

-- class=destinee_service_role table=email_send_state
DROP POLICY IF EXISTS 'Service role can manage send state' ON public."email_send_state";
CREATE POLICY 'Service role can manage send state'
  ON public."email_send_state"
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING ((auth.role() = 'service_role'::text))
  WITH CHECK ((auth.role() = 'service_role'::text))
;

-- class=destinee_service_role table=email_unsubscribe_tokens
DROP POLICY IF EXISTS 'Service role can insert tokens' ON public."email_unsubscribe_tokens";
CREATE POLICY 'Service role can insert tokens'
  ON public."email_unsubscribe_tokens"
  AS PERMISSIVE
  FOR INSERT
  TO service_role
  WITH CHECK ((auth.role() = 'service_role'::text))
;

-- class=destinee_service_role table=email_unsubscribe_tokens
DROP POLICY IF EXISTS 'Service role can mark tokens as used' ON public."email_unsubscribe_tokens";
CREATE POLICY 'Service role can mark tokens as used'
  ON public."email_unsubscribe_tokens"
  AS PERMISSIVE
  FOR UPDATE
  TO service_role
  USING ((auth.role() = 'service_role'::text))
  WITH CHECK ((auth.role() = 'service_role'::text))
;

-- class=destinee_service_role table=email_unsubscribe_tokens
DROP POLICY IF EXISTS 'Service role can read tokens' ON public."email_unsubscribe_tokens";
CREATE POLICY 'Service role can read tokens'
  ON public."email_unsubscribe_tokens"
  AS PERMISSIVE
  FOR SELECT
  TO service_role
  USING ((auth.role() = 'service_role'::text))
;

-- class=destinee_service_role table=homework_generation_queue
DROP POLICY IF EXISTS 'service role manages queue' ON public."homework_generation_queue";
CREATE POLICY 'service role manages queue'
  ON public."homework_generation_queue"
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING ((auth.role() = 'service_role'::text))
  WITH CHECK ((auth.role() = 'service_role'::text))
;

-- class=destinee_service_role table=suppressed_emails
DROP POLICY IF EXISTS 'Service role can insert suppressed emails' ON public."suppressed_emails";
CREATE POLICY 'Service role can insert suppressed emails'
  ON public."suppressed_emails"
  AS PERMISSIVE
  FOR INSERT
  TO service_role
  WITH CHECK ((auth.role() = 'service_role'::text))
;

-- class=destinee_service_role table=suppressed_emails
DROP POLICY IF EXISTS 'Service role can read suppressed emails' ON public."suppressed_emails";
CREATE POLICY 'Service role can read suppressed emails'
  ON public."suppressed_emails"
  AS PERMISSIVE
  FOR SELECT
  TO service_role
  USING ((auth.role() = 'service_role'::text))
;

-- class=destinee_service_role table=sync_log
DROP POLICY IF EXISTS 'Service role manages sync_log' ON public."sync_log";
CREATE POLICY 'Service role manages sync_log'
  ON public."sync_log"
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING ((auth.role() = 'service_role'::text))
  WITH CHECK ((auth.role() = 'service_role'::text))
;

SELECT 'lot2a_proposed_03_public_service_destined_to_service_role_FULL.sql_ready'::text AS status;