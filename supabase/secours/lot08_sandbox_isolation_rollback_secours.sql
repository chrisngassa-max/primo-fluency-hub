-- =============================================================================
-- ABANDONED / DO NOT USE — CAPTCF Lot 0.8B
-- =============================================================================
-- Phase B (DROP of the 6 RESTRICTIVE "Sandbox isolation" policies) is CANCELLED.
-- The six policies currently deployed AS RESTRICTIVE must be PRESERVED.
--
-- This file was prepared as a compensatory rollback AFTER a forward DROP that
-- must never be applied. Keeping it only as documentary archaeology.
--
-- DO NOT run this script against production or any shared environment.
-- DO NOT use it to recreate PERMISSIVE Sandbox isolation policies.
-- Historical definition source: supabase/migrations/20260608210000_sandbox_v4.sql
-- =============================================================================

-- (Body retained for documentary history only — not an operational runbook.)

DROP POLICY IF EXISTS "Sandbox isolation" ON public.groups;
CREATE POLICY "Sandbox isolation" ON public.groups AS RESTRICTIVE FOR SELECT
  USING (
    sandbox_session_id IS NULL OR public.can_access_sandbox(sandbox_session_id)
  );

DROP POLICY IF EXISTS "Sandbox isolation" ON public.group_members;
CREATE POLICY "Sandbox isolation" ON public.group_members AS RESTRICTIVE FOR SELECT
  USING (
    sandbox_session_id IS NULL OR public.can_access_sandbox(sandbox_session_id)
  );

DROP POLICY IF EXISTS "Sandbox isolation" ON public.sessions;
CREATE POLICY "Sandbox isolation" ON public.sessions AS RESTRICTIVE FOR SELECT
  USING (
    sandbox_session_id IS NULL OR public.can_access_sandbox(sandbox_session_id)
  );

DROP POLICY IF EXISTS "Sandbox isolation" ON public.resultats;
CREATE POLICY "Sandbox isolation" ON public.resultats AS RESTRICTIVE FOR SELECT
  USING (
    sandbox_session_id IS NULL OR public.can_access_sandbox(sandbox_session_id)
  );

DROP POLICY IF EXISTS "Sandbox isolation" ON public.devoirs;
CREATE POLICY "Sandbox isolation" ON public.devoirs AS RESTRICTIVE FOR SELECT
  USING (
    sandbox_session_id IS NULL OR public.can_access_sandbox(sandbox_session_id)
  );

DROP POLICY IF EXISTS "Sandbox isolation" ON public.profils_eleves;
CREATE POLICY "Sandbox isolation" ON public.profils_eleves AS RESTRICTIVE FOR SELECT
  USING (
    sandbox_session_id IS NULL OR public.can_access_sandbox(sandbox_session_id)
  );
