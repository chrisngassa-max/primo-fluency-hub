-- Drop defaults that reference the enum first
ALTER TABLE public.groups ALTER COLUMN niveau SET DEFAULT 'A1';
ALTER TABLE public.sessions ALTER COLUMN niveau_cible SET DEFAULT 'A2';
ALTER TABLE public.sequences_pedagogiques ALTER COLUMN niveau SET DEFAULT 'A2';
ALTER TABLE public.exercices ALTER COLUMN niveau_vise SET DEFAULT 'A2';
ALTER TABLE public.points_a_maitriser ALTER COLUMN niveau_min SET DEFAULT 'A1';
ALTER TABLE public.points_a_maitriser ALTER COLUMN niveau_max SET DEFAULT 'B1';
ALTER TABLE public.profils_eleves ALTER COLUMN niveau_actuel SET DEFAULT 'A1';
ALTER TABLE public.test_entree_items ALTER COLUMN niveau SET DEFAULT 'A1';

-- Now convert columns to TEXT
ALTER TABLE public.groups ALTER COLUMN niveau TYPE text;
ALTER TABLE public.sessions ALTER COLUMN niveau_cible TYPE text;
ALTER TABLE public.sequences_pedagogiques ALTER COLUMN niveau TYPE text;
ALTER TABLE public.exercices ALTER COLUMN niveau_vise TYPE text;
ALTER TABLE public.points_a_maitriser ALTER COLUMN niveau_min TYPE text;
ALTER TABLE public.points_a_maitriser ALTER COLUMN niveau_max TYPE text;
ALTER TABLE public.profils_eleves ALTER COLUMN niveau_actuel TYPE text;
ALTER TABLE public.tests_entree ALTER COLUMN niveau_estime TYPE text;
ALTER TABLE public.test_entree_items ALTER COLUMN niveau TYPE text;

-- Drop the enum
DROP TYPE IF EXISTS public.niveau_cecrl CASCADE;