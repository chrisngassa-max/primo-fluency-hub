-- =============================================================================
-- CAPTCF LOT 2A — PROPOSED ROLLBACK — has_role
-- Restores parameter NAMES to legacy (_user_id, _role) matching old migration.
-- Body identical. Use ONLY if a canonical rename broke named PostgREST callers
-- that still send _user_id/_role AND you need emergency compatibility.
-- Prefer fixing Edge callers forward rather than rolling back names.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated, service_role;
