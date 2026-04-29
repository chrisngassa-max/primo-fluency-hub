-- Activer Realtime correctement sur exercise_attempts pour le suivi en direct formateur
-- 1) REPLICA IDENTITY FULL: les events UPDATE incluent toutes les colonnes (avant/après)
ALTER TABLE public.exercise_attempts REPLICA IDENTITY FULL;

-- 2) Ajout idempotent à la publication supabase_realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'exercise_attempts'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.exercise_attempts';
  END IF;
END $$;