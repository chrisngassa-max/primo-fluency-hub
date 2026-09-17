-- =============================================================================
-- CAPTCF LOT 2A — PROPOSED (NOT APPLIED) — has_role canonical contract
-- Path: supabase/proposed/lot2a/ (outside supabase/migrations/ to avoid accidental apply)
-- Project target (when authorized): gudcenhmzlcvhgbgklzw
-- =============================================================================
-- FACTS (Phase A remote SELECT):
--   Remote has ONE overload:
--     public.has_role(uid uuid, target_role app_role) → boolean
--     SECURITY DEFINER, STABLE, search_path=public
--     EXECUTE granted to anon, authenticated, service_role
--   Local migration 20260317202908 still documents (_user_id, _role) — DRIFT.
--   types.ts already matches remote (uid, target_role).
--
-- IMPORTANT PostgreSQL constraint:
--   Two functions with identical argument TYPES (uuid, app_role) cannot coexist
--   as overloads. Named-parameter dual contract is IMPOSSIBLE without a rename
--   or a differently-typed wrapper. Transition = fix named RPC callers, keep
--   single canonical signature.
--
-- Canonical contract (proposed / already on remote):
--   has_role(uid uuid, target_role public.app_role) RETURNS boolean
--   SECURITY DEFINER SET search_path = public
--   NULL uid OR NULL role → false (EXISTS yields false)
--
-- This file is IDEMPOTENT with current remote. Apply ONLY with explicit owner
-- authorization (Phase B sous-lot). Aligns git source-of-truth; does not fix
-- Edge callers by itself.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.has_role(uid uuid, target_role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = uid
      AND role = target_role
  );
$$;

COMMENT ON FUNCTION public.has_role(uuid, public.app_role) IS
  'CAPTCF canonical role check. Args: uid, target_role. Positional SQL OK. PostgREST named: uid / target_role only.';

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
-- anon EXECUTE retained only if product still needs it for a documented path;
-- default proposal: revoke anon (latent hygiene). Uncomment when authorized:
-- REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon;
