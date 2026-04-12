-- Drop the old check constraint on difficulte (1-5 range)
ALTER TABLE public.exercices DROP CONSTRAINT IF EXISTS exercices_difficulte_check;

-- Add new check constraint allowing 0-10 range
ALTER TABLE public.exercices ADD CONSTRAINT exercices_difficulte_check CHECK (difficulte >= 0 AND difficulte <= 10);