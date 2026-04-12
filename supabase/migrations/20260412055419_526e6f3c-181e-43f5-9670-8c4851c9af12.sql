
-- Create enum for resource type
CREATE TYPE public.ressource_type AS ENUM ('lecon', 'vocabulaire', 'rappel_methodo', 'rappel_visuel');

-- Create enum for resource source
CREATE TYPE public.ressource_source AS ENUM ('auto', 'manuel');

-- Create enum for resource status
CREATE TYPE public.ressource_statut AS ENUM ('draft', 'published');

-- Create the table
CREATE TABLE public.ressources_pedagogiques (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  formateur_id UUID NOT NULL,
  session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
  exercice_id UUID REFERENCES public.exercices(id) ON DELETE SET NULL,
  type ressource_type NOT NULL,
  competence public.competence_type NOT NULL,
  niveau TEXT NOT NULL DEFAULT 'A1',
  titre TEXT NOT NULL,
  contenu JSONB NOT NULL DEFAULT '{}'::jsonb,
  source ressource_source NOT NULL DEFAULT 'manuel',
  statut ressource_statut NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ressources_pedagogiques ENABLE ROW LEVEL SECURITY;

-- Formateurs manage their own resources
CREATE POLICY "Formateurs manage own ressources"
ON public.ressources_pedagogiques
FOR ALL
TO authenticated
USING (formateur_id = auth.uid())
WITH CHECK (formateur_id = auth.uid());

-- Eleves can view published resources linked to their group sessions
CREATE POLICY "Eleves view published ressources"
ON public.ressources_pedagogiques
FOR SELECT
TO authenticated
USING (
  statut = 'published' AND
  session_id IN (
    SELECT s.id FROM sessions s
    JOIN group_members gm ON gm.group_id = s.group_id
    WHERE gm.eleve_id = auth.uid()
  )
);

-- Index for performance
CREATE INDEX idx_ressources_session ON public.ressources_pedagogiques(session_id);
CREATE INDEX idx_ressources_formateur ON public.ressources_pedagogiques(formateur_id);
CREATE INDEX idx_ressources_type ON public.ressources_pedagogiques(type);
CREATE INDEX idx_ressources_competence ON public.ressources_pedagogiques(competence);
