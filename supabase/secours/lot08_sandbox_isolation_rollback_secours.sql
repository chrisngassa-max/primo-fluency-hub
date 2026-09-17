-- CAPTCF Lot 0.8 — compensatory rollback (secours, NOT in auto migration chain)
-- Restores the 6 RESTRICTIVE "Sandbox isolation" policies as originally defined in
-- supabase/migrations/20260608210000_sandbox_v4.sql.
-- Use ONLY if Lot 0.8 forward apply must be reversed after owner decision.
-- Does NOT reopen anon grants. Does NOT modify historical migrations.

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
