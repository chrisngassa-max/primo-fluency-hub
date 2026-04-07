
ALTER TABLE public.session_exercices ADD COLUMN IF NOT EXISTS is_bonus boolean NOT NULL DEFAULT false;
ALTER TABLE public.session_exercices ADD COLUMN IF NOT EXISTS eleve_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.resultats ADD COLUMN IF NOT EXISTS is_bonus boolean NOT NULL DEFAULT false;
