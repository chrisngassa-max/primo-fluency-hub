
-- Table des parcours de formation (plans / templates)
CREATE TABLE public.parcours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formateur_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  titre text NOT NULL,
  description text,
  niveau_depart text NOT NULL DEFAULT 'A0',
  niveau_cible text NOT NULL DEFAULT 'A1',
  heures_totales_prevues numeric NOT NULL DEFAULT 0,
  heures_totales_reelles numeric NOT NULL DEFAULT 0,
  nb_seances_prevues integer NOT NULL DEFAULT 0,
  is_template boolean NOT NULL DEFAULT false,
  statut text NOT NULL DEFAULT 'brouillon',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.parcours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Formateurs manage own parcours"
  ON public.parcours FOR ALL
  TO public
  USING (formateur_id = auth.uid())
  WITH CHECK (formateur_id = auth.uid());

-- Table des séances planifiées dans un parcours
CREATE TABLE public.parcours_seances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parcours_id uuid NOT NULL REFERENCES public.parcours(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  ordre integer NOT NULL DEFAULT 0,
  titre text NOT NULL,
  objectif_principal text,
  competences_cibles text[] NOT NULL DEFAULT '{}',
  duree_minutes integer NOT NULL DEFAULT 90,
  nb_exercices_suggeres integer NOT NULL DEFAULT 5,
  statut text NOT NULL DEFAULT 'prevu',
  heures_reelles numeric DEFAULT 0,
  exercices_faits integer DEFAULT 0,
  exercices_total integer DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.parcours_seances ENABLE ROW LEVEL SECURITY;

-- Function to get parcours formateur
CREATE OR REPLACE FUNCTION public.get_parcours_formateur(_parcours_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT formateur_id FROM public.parcours WHERE id = _parcours_id;
$$;

CREATE POLICY "Formateurs manage parcours_seances"
  ON public.parcours_seances FOR ALL
  TO public
  USING (get_parcours_formateur(parcours_id) = auth.uid())
  WITH CHECK (get_parcours_formateur(parcours_id) = auth.uid());
