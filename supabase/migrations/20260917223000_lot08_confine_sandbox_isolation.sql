-- CAPTCF Lot 0.8 — confinement Sandbox authenticated (Phase B apply only after owner auth)
-- Idempotent forward migration: remove the 6 "Sandbox isolation" policies.
--
-- Diagnosis (read-only, project gudcenhmzlcvhgbgklzw):
--   * The 6 policies are AS RESTRICTIVE (polpermissive=false), roles {public}, SELECT only.
--   * USING ((sandbox_session_id IS NULL) OR can_access_sandbox(sandbox_session_id))
--     is the correct AND-filter gate for RESTRICTIVE policies — it does NOT OR-open
--     production rows the way a PERMISSIVE policy with the same expression would.
--   * Lot 0.7 flagged them as ACTIVE authenticated exposure under a PERMISSIVE OR
--     misreading; baseline RLS matrix (stranger / eleve / formateur / sandbox) passed.
--
-- Choice retained: DROP (not blind OR→AND replace).
--   Transactional DROP-simulation on production data (ROLLBACK) showed business
--   policies already cover propriétaire / élève / formateur / membre Sandbox without
--   leaking foreign prod or foreign Sandbox rows. Sandbox Edge paths use service_role.
--
-- Does NOT modify historical migration 20260608210000_sandbox_v4.sql.
-- Does NOT touch has_role, GRANT anon, or the other {public} policies (Lot 2A hygiene).

DROP POLICY IF EXISTS "Sandbox isolation" ON public.groups;
DROP POLICY IF EXISTS "Sandbox isolation" ON public.group_members;
DROP POLICY IF EXISTS "Sandbox isolation" ON public.sessions;
DROP POLICY IF EXISTS "Sandbox isolation" ON public.devoirs;
DROP POLICY IF EXISTS "Sandbox isolation" ON public.resultats;
DROP POLICY IF EXISTS "Sandbox isolation" ON public.profils_eleves;
