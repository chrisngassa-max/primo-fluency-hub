
CREATE TABLE IF NOT EXISTS public.gabarits_pedagogiques (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero integer NOT NULL UNIQUE,
  titre text NOT NULL,
  bloc text,
  palier_cecrl text,
  niveau_cible text,
  competences_cibles text[] NOT NULL DEFAULT '{}',
  objectif_principal text,
  lexique_cibles text[] NOT NULL DEFAULT '{}',
  consignes_generation text,
  criteres_reussite text,
  dependances_seances integer[] NOT NULL DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.gabarits_pedagogiques ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gabarits_authenticated_read"
  ON public.gabarits_pedagogiques
  FOR SELECT
  TO authenticated
  USING (true);
