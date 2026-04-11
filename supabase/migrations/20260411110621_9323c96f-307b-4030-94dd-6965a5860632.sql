-- Add serie column to devoirs table
ALTER TABLE public.devoirs
ADD COLUMN serie integer;

-- Add comment for documentation
COMMENT ON COLUMN public.devoirs.serie IS '1 = remédiation, 2 = consolidation. NULL for manually sent homework.';
