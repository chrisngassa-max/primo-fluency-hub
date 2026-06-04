BEGIN;

CREATE TABLE IF NOT EXISTS public.session_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_session_id uuid REFERENCES public.sessions(id) ON DELETE CASCADE,
  target_session_id uuid REFERENCES public.sessions(id) ON DELETE CASCADE,
  formateur_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (
    type IN (
      'mise_en_commun',
      'atelier_remediation',
      'seance_complementaire',
      'devoir_individuel',
      'support_guide'
    )
  ),
  competence text CHECK (competence IN ('CO','CE','EE','EO','Structures')),
  eleves_concernes jsonb NOT NULL DEFAULT '[]'::jsonb,
  raison_formateur text NOT NULL,
  action_proposee jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT 'system' CHECK (source IN ('system','formateur')),
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','accepted','modified','rejected')),
  validated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  validated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_recommendations_formateur_created
  ON public.session_recommendations(formateur_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_session_recommendations_target_status
  ON public.session_recommendations(target_session_id, status);

CREATE INDEX IF NOT EXISTS idx_session_recommendations_source_session
  ON public.session_recommendations(source_session_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_recommendations TO authenticated;
GRANT ALL ON public.session_recommendations TO service_role;

ALTER TABLE public.session_recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Formateurs manage own session recommendations" ON public.session_recommendations;
CREATE POLICY "Formateurs manage own session recommendations"
  ON public.session_recommendations
  FOR ALL
  TO authenticated
  USING (
    formateur_id = auth.uid()
    OR (
      target_session_id IS NOT NULL
      AND public.get_session_formateur(target_session_id) = auth.uid()
    )
    OR (
      source_session_id IS NOT NULL
      AND public.get_session_formateur(source_session_id) = auth.uid()
    )
  )
  WITH CHECK (
    formateur_id = auth.uid()
    OR (
      target_session_id IS NOT NULL
      AND public.get_session_formateur(target_session_id) = auth.uid()
    )
    OR (
      source_session_id IS NOT NULL
      AND public.get_session_formateur(source_session_id) = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins manage session recommendations" ON public.session_recommendations;
CREATE POLICY "Admins manage session recommendations"
  ON public.session_recommendations
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

COMMENT ON TABLE public.session_recommendations IS
  'Recommendations pedagogiques proposees par le systeme. Aucune modification de seance ne doit etre appliquee sans validation formateur.';

COMMIT;
