-- =============================================================================
-- CAPTCF LOT 2A — PROPOSED (NOT APPLIED) — B4 misc hygiene {public} → TO authenticated
-- Generated from CAPTCF_LOT_02A_POLICIES_INVENTORY.json
-- Count: 1
-- Target role clause: TO authenticated
-- DO NOT place under supabase/migrations/ until owner-authorized.
-- =============================================================================

-- class=hygiene_seulement table=ai_processing_logs
DROP POLICY IF EXISTS 'no update ai logs' ON public."ai_processing_logs";
CREATE POLICY 'no update ai logs'
  ON public."ai_processing_logs"
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (false)
;

SELECT 'lot2a_proposed_05_public_hygiene_misc_to_authenticated_FULL.sql_ready'::text AS status;