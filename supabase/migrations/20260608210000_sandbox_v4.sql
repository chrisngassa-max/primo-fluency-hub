CREATE TABLE IF NOT EXISTS public.sandbox_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formateur_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  statut text NOT NULL DEFAULT 'provisioning'
    CHECK (statut IN ('provisioning', 'active', 'expired', 'reset')),
  group_id uuid,
  eleve_user_ids uuid[] NOT NULL DEFAULT '{}',
  eleve_emails jsonb NOT NULL DEFAULT '[]',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  last_activity timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_formateur_sandbox UNIQUE (formateur_id)
);

ALTER TABLE public.sandbox_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Formateur voit uniquement son sandbox" ON public.sandbox_sessions;
CREATE POLICY "Formateur voit uniquement son sandbox"
  ON public.sandbox_sessions
  FOR ALL
  USING (formateur_id = auth.uid())
  WITH CHECK (formateur_id = auth.uid());

ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS sandbox_session_id uuid
  REFERENCES public.sandbox_sessions(id) ON DELETE CASCADE;
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS sandbox_session_id uuid
  REFERENCES public.sandbox_sessions(id) ON DELETE CASCADE;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS sandbox_session_id uuid
  REFERENCES public.sandbox_sessions(id) ON DELETE CASCADE;
ALTER TABLE public.resultats ADD COLUMN IF NOT EXISTS sandbox_session_id uuid
  REFERENCES public.sandbox_sessions(id) ON DELETE CASCADE;
ALTER TABLE public.devoirs ADD COLUMN IF NOT EXISTS sandbox_session_id uuid
  REFERENCES public.sandbox_sessions(id) ON DELETE CASCADE;
ALTER TABLE public.profils_eleves ADD COLUMN IF NOT EXISTS sandbox_session_id uuid
  REFERENCES public.sandbox_sessions(id) ON DELETE CASCADE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sandbox_sessions_group_id_fkey'
  ) THEN
    ALTER TABLE public.sandbox_sessions
      ADD CONSTRAINT sandbox_sessions_group_id_fkey
      FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_groups_sbx ON public.groups (sandbox_session_id)
  WHERE sandbox_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_group_members_sbx ON public.group_members (sandbox_session_id)
  WHERE sandbox_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_sbx ON public.sessions (sandbox_session_id)
  WHERE sandbox_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_resultats_sbx ON public.resultats (sandbox_session_id)
  WHERE sandbox_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_devoirs_sbx ON public.devoirs (sandbox_session_id)
  WHERE sandbox_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profils_eleves_sbx ON public.profils_eleves (sandbox_session_id)
  WHERE sandbox_session_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.can_access_sandbox(_sandbox_session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.sandbox_sessions ss
    WHERE ss.id = _sandbox_session_id
      AND ss.statut = 'active'
      AND (
        ss.formateur_id = auth.uid()
        OR auth.uid() = ANY(ss.eleve_user_ids)
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_access_sandbox(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_sandbox(uuid) TO authenticated;

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

CREATE OR REPLACE FUNCTION public.propagate_sandbox_session_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.sandbox_session_id IS NULL THEN
    SELECT pe.sandbox_session_id INTO NEW.sandbox_session_id
    FROM public.profils_eleves pe
    WHERE pe.eleve_id = NEW.eleve_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS resultats_propagate_sandbox ON public.resultats;
CREATE TRIGGER resultats_propagate_sandbox
  BEFORE INSERT ON public.resultats
  FOR EACH ROW EXECUTE FUNCTION public.propagate_sandbox_session_id();

DROP TRIGGER IF EXISTS devoirs_propagate_sandbox ON public.devoirs;
CREATE TRIGGER devoirs_propagate_sandbox
  BEFORE INSERT ON public.devoirs
  FOR EACH ROW EXECUTE FUNCTION public.propagate_sandbox_session_id();
