BEGIN;

CREATE TABLE IF NOT EXISTS public.session_templates_v4 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  theme text NOT NULL CHECK (
    theme IN (
      'logement',
      'sante',
      'travail',
      'transport',
      'banque',
      'prefecture',
      'ecole',
      'vie_citoyenne'
    )
  ),
  objectif_commun text NOT NULL,
  duree_totale_min integer NOT NULL DEFAULT 80 CHECK (duree_totale_min BETWEEN 30 AND 240),
  mvp_competences text[] NOT NULL DEFAULT ARRAY['CE','CO']::text[]
    CHECK (mvp_competences <@ ARRAY['CO','CE','EE','EO']::text[]),
  phases jsonb NOT NULL,
  is_public boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_templates_v4_theme
  ON public.session_templates_v4(theme);

CREATE INDEX IF NOT EXISTS idx_session_templates_v4_created_by
  ON public.session_templates_v4(created_by);

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS session_template_v4_id uuid
  REFERENCES public.session_templates_v4(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_session_template_v4
  ON public.sessions(session_template_v4_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_templates_v4 TO authenticated;
GRANT ALL ON public.session_templates_v4 TO service_role;

ALTER TABLE public.session_templates_v4 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated view active session templates v4" ON public.session_templates_v4;
CREATE POLICY "Authenticated view active session templates v4"
  ON public.session_templates_v4
  FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND (
      is_public = true
      OR created_by = auth.uid()
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

DROP POLICY IF EXISTS "Formateurs manage own session templates v4" ON public.session_templates_v4;
CREATE POLICY "Formateurs manage own session templates v4"
  ON public.session_templates_v4
  FOR ALL
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Admins manage session templates v4" ON public.session_templates_v4;
CREATE POLICY "Admins manage session templates v4"
  ON public.session_templates_v4
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

COMMENT ON TABLE public.session_templates_v4 IS 'Modeles de seance pedagogique V4 en 5 phases: ouverture, tronc commun, atelier cible, mise en commun, devoir.';
COMMENT ON COLUMN public.session_templates_v4.phases IS 'JSONB valide cote application via SessionTemplateV4; contient les 5 phases obligatoires.';
COMMENT ON COLUMN public.sessions.session_template_v4_id IS 'Modele pedagogique V4 optionnel utilise pour structurer la seance.';

COMMIT;
