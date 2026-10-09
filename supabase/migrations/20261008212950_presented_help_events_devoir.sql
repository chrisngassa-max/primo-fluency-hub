-- Lot aide devoir sans séance — journalisation des indices réellement présentés.
-- session_live_events.session_id reste NOT NULL (atelier live inchangé).
-- Cette table couvre uniquement le cas devoir attribué (devoirs.session_id NULL ou non).
-- Aucune SECURITY DEFINER. Accès via devoirs.eleve_id / devoirs.formateur_id.

BEGIN;

CREATE TABLE IF NOT EXISTS public.presented_help_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'indice_presente'
    CHECK (kind = 'indice_presente'),
  eleve_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  devoir_id uuid NOT NULL REFERENCES public.devoirs(id) ON DELETE CASCADE,
  exercice_id uuid NOT NULL,
  item_id text NOT NULL,
  tentative_id uuid NULL,
  session_id uuid NULL REFERENCES public.sessions(id) ON DELETE SET NULL,
  mode text NOT NULL,
  niveau text NOT NULL,
  niveau_aide integer NOT NULL CHECK (niveau_aide >= 1),
  origine text NOT NULL CHECK (origine IN ('banque', 'generation_directe')),
  contenu_version text NOT NULL,
  sous_competence text,
  presented_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT presented_help_events_item_nonempty CHECK (length(btrim(item_id)) > 0)
);

COMMENT ON TABLE public.presented_help_events IS
  'Indices banque réellement présentés sur un devoir attribué (y compris sans session_id). Pas de réponses élève.';

-- Idempotence : même présentation (élève/devoir/exercice/item/niveau/tentative/origine).
CREATE UNIQUE INDEX IF NOT EXISTS presented_help_events_dedupe_idx
  ON public.presented_help_events (
    eleve_id,
    devoir_id,
    exercice_id,
    item_id,
    niveau_aide,
    origine,
    COALESCE(tentative_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

CREATE INDEX IF NOT EXISTS presented_help_events_devoir_idx
  ON public.presented_help_events (devoir_id, created_at DESC);

CREATE INDEX IF NOT EXISTS presented_help_events_formateur_lookup_idx
  ON public.presented_help_events (eleve_id, exercice_id, presented_at DESC);

ALTER TABLE public.presented_help_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS phe_insert_eleve ON public.presented_help_events;
CREATE POLICY phe_insert_eleve ON public.presented_help_events
  FOR INSERT TO authenticated
  WITH CHECK (
    eleve_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.devoirs d
      WHERE d.id = devoir_id
        AND d.eleve_id = auth.uid()
        AND d.exercice_id = presented_help_events.exercice_id
    )
  );

DROP POLICY IF EXISTS phe_select_eleve ON public.presented_help_events;
CREATE POLICY phe_select_eleve ON public.presented_help_events
  FOR SELECT TO authenticated
  USING (eleve_id = auth.uid());

DROP POLICY IF EXISTS phe_select_formateur ON public.presented_help_events;
CREATE POLICY phe_select_formateur ON public.presented_help_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.devoirs d
      WHERE d.id = devoir_id
        AND d.formateur_id = auth.uid()
    )
  );

REVOKE ALL ON public.presented_help_events FROM PUBLIC;
GRANT SELECT, INSERT ON public.presented_help_events TO authenticated;

COMMIT;
