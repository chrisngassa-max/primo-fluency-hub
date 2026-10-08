-- Lot 5B — persistance locale du cycle d’alertes pédagogiques.
-- Relations d’accès réutilisées (sans nouvelle SECURITY DEFINER) :
--   groups.formateur_id + group_members.eleve_id
--   (même motif que policies profiles / resultats / student_level_baselines).
-- Ne touche pas session_live_events ni exercise_attempts.

BEGIN;

CREATE TABLE IF NOT EXISTS public.pedagogical_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formateur_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  eleve_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sous_competence text NOT NULL,
  rule_id text NOT NULL,
  status text NOT NULL DEFAULT 'nouveau'
    CHECK (status IN ('nouveau', 'confirme', 'classe')),
  motif_classement text,
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  -- Preuves limitées : ids de tentatives/événements + compteurs. Jamais de réponses élève.
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  classified_at timestamptz,
  CONSTRAINT pedagogical_alerts_window_coherent CHECK (window_end >= window_start),
  CONSTRAINT pedagogical_alerts_motif_si_classe CHECK (
    status <> 'classe' OR (motif_classement IS NOT NULL AND length(btrim(motif_classement)) > 0)
  )
);

COMMENT ON TABLE public.pedagogical_alerts IS
  'Lot 5B — alertes pédagogiques formateur (nouveau→confirme→classe). Preuves = références d’attempts/events uniquement.';

COMMENT ON COLUMN public.pedagogical_alerts.evidence IS
  'JSON attendu : {attempt_ids:uuid[], event_ids:uuid[], failures_count:int, max_help_uses:int, reason?:text}. Pas de réponses ni conversation.';

-- Une seule alerte ouverte (nouveau|confirme) par combinaison.
CREATE UNIQUE INDEX IF NOT EXISTS pedagogical_alerts_one_open_idx
  ON public.pedagogical_alerts (formateur_id, eleve_id, sous_competence, rule_id)
  WHERE status IN ('nouveau', 'confirme');

CREATE INDEX IF NOT EXISTS pedagogical_alerts_formateur_status_idx
  ON public.pedagogical_alerts (formateur_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS pedagogical_alerts_eleve_idx
  ON public.pedagogical_alerts (eleve_id, sous_competence);

-- Accès formateur → élève via groupes existants (pas de nouvelle SECURITY DEFINER).
CREATE OR REPLACE FUNCTION public.formateur_teaches_eleve(p_formateur_id uuid, p_eleve_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members gm
    JOIN public.groups g ON g.id = gm.group_id
    WHERE gm.eleve_id = p_eleve_id
      AND g.formateur_id = p_formateur_id
  );
$$;

COMMENT ON FUNCTION public.formateur_teaches_eleve(uuid, uuid) IS
  'Lot 5B — true si p_formateur_id enseigne p_eleve_id via groups/group_members. SECURITY INVOKER.';

REVOKE EXECUTE ON FUNCTION public.formateur_teaches_eleve(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.formateur_teaches_eleve(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.formateur_teaches_eleve(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_pedagogical_alerts_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS DISTINCT FROM 'nouveau' THEN
      RAISE EXCEPTION 'pedagogical_alerts: insert uniquement en status=nouveau';
    END IF;
    IF NEW.motif_classement IS NOT NULL AND length(btrim(NEW.motif_classement)) > 0 THEN
      RAISE EXCEPTION 'pedagogical_alerts: motif_classement interdit à la création';
    END IF;
    IF NEW.confirmed_at IS NOT NULL OR NEW.classified_at IS NOT NULL THEN
      RAISE EXCEPTION 'pedagogical_alerts: dates de confirmation/classement interdites à la création';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE : identité / règle / sous-compétence immuables
  IF NEW.formateur_id IS DISTINCT FROM OLD.formateur_id
     OR NEW.eleve_id IS DISTINCT FROM OLD.eleve_id
     OR NEW.rule_id IS DISTINCT FROM OLD.rule_id
     OR NEW.sous_competence IS DISTINCT FROM OLD.sous_competence
     OR NEW.id IS DISTINCT FROM OLD.id
  THEN
    RAISE EXCEPTION 'pedagogical_alerts: identité, règle et sous-compétence immuables';
  END IF;

  -- Preuves / fenêtre : immuables après insert (idempotence = conserver la 1re preuve)
  IF NEW.evidence IS DISTINCT FROM OLD.evidence
     OR NEW.window_start IS DISTINCT FROM OLD.window_start
     OR NEW.window_end IS DISTINCT FROM OLD.window_end
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'pedagogical_alerts: preuves, fenêtre et created_at immuables';
  END IF;

  -- Transitions strictes : nouveau → confirme → classe (pas de saut, pas d’inverse)
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status = 'nouveau' AND NEW.status = 'confirme' THEN
      NEW.confirmed_at := COALESCE(NEW.confirmed_at, now());
      NEW.classified_at := NULL;
      NEW.motif_classement := NULL;
    ELSIF OLD.status = 'confirme' AND NEW.status = 'classe' THEN
      IF NEW.motif_classement IS NULL OR length(btrim(NEW.motif_classement)) = 0 THEN
        RAISE EXCEPTION 'pedagogical_alerts: motif_classement requis pour classer';
      END IF;
      NEW.classified_at := COALESCE(NEW.classified_at, now());
    ELSE
      RAISE EXCEPTION 'pedagogical_alerts: transition interdite % → %', OLD.status, NEW.status;
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_pedagogical_alerts_write ON public.pedagogical_alerts;
CREATE TRIGGER trg_guard_pedagogical_alerts_write
  BEFORE INSERT OR UPDATE ON public.pedagogical_alerts
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_pedagogical_alerts_write();

ALTER TABLE public.pedagogical_alerts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.pedagogical_alerts FROM PUBLIC;
REVOKE ALL ON TABLE public.pedagogical_alerts FROM anon;
REVOKE ALL ON TABLE public.pedagogical_alerts FROM authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.pedagogical_alerts TO authenticated;

-- Formateur : lecture de SES alertes pour SES élèves de groupe uniquement.
DROP POLICY IF EXISTS pedagogical_alerts_select_formateur ON public.pedagogical_alerts;
CREATE POLICY pedagogical_alerts_select_formateur
  ON public.pedagogical_alerts
  FOR SELECT
  TO authenticated
  USING (
    formateur_id = auth.uid()
    AND public.formateur_teaches_eleve(auth.uid(), eleve_id)
  );

-- Insert : formateur authentifié, élève réellement dans un de ses groupes.
DROP POLICY IF EXISTS pedagogical_alerts_insert_formateur ON public.pedagogical_alerts;
CREATE POLICY pedagogical_alerts_insert_formateur
  ON public.pedagogical_alerts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    formateur_id = auth.uid()
    AND public.formateur_teaches_eleve(auth.uid(), eleve_id)
  );

-- Update : même périmètre ; le trigger bloque identité/preuves hors nouveau.
DROP POLICY IF EXISTS pedagogical_alerts_update_formateur ON public.pedagogical_alerts;
CREATE POLICY pedagogical_alerts_update_formateur
  ON public.pedagogical_alerts
  FOR UPDATE
  TO authenticated
  USING (
    formateur_id = auth.uid()
    AND public.formateur_teaches_eleve(auth.uid(), eleve_id)
  )
  WITH CHECK (
    formateur_id = auth.uid()
    AND public.formateur_teaches_eleve(auth.uid(), eleve_id)
  );

-- Pas de DELETE pour authenticated (classement suffit).
-- Pas de policy élève : les élèves ne lisent ni ne modifient.

COMMIT;
