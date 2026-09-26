-- =============================================================================
-- CAPTCF LOT 2A — PROPOSED (NOT APPLIED) — sous-lot B1
-- Convert {public} → TO authenticated for SCOPED ownership policies only.
-- Does NOT touch: Sandbox isolation RESTRICTIVE (6), service_role-destined,
-- USING(true) broad catalogs, or has_role-dependent policies (separate sous-lots).
--
-- Method: DROP POLICY + CREATE POLICY with identical USING/WITH CHECK, TO authenticated.
-- Risk if applied: clients using role "anon" with table GRANT (should be none post Lot 0.6)
-- would lose RLS pass-through; service_role bypasses RLS so unaffected; authenticated OK.
--
-- THIS FILE IS A TEMPLATE GENERATOR TARGET — full 90-policy SQL is in
-- 02b_public_to_authenticated_scoped_FULL.sql (generated). Review each table
-- before authorize. Do NOT apply mechanically without sampling.
-- =============================================================================

-- Example pattern (do not apply alone):
-- DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
-- CREATE POLICY "Users view own profile"
--   ON public.profiles
--   FOR SELECT
--   TO authenticated
--   USING (id = auth.uid());

-- STOP: see companion FULL file + handoff matrix before any remote apply.
SELECT 'lot2a_proposed_B1_template_only'::text AS status;
