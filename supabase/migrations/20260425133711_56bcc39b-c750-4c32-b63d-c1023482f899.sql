-- 1. Ajouter 'archive' à l'enum devoir_statut s'il n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumtypid = 'devoir_statut'::regtype 
    AND enumlabel = 'archive'
  ) THEN
    ALTER TYPE devoir_statut ADD VALUE 'archive';
  END IF;
END$$;

-- 2. Ajouter colonnes archived_at pour traçabilité
ALTER TABLE public.devoirs 
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_reason text;

ALTER TABLE public.bilan_tests 
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_reason text;

ALTER TABLE public.bilan_post_devoirs 
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_reason text;
