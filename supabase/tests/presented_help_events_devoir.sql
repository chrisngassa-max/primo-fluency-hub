-- Tests locaux SQL — presented_help_events (devoir sans séance).
-- Exécution locale uniquement ; ne pas appliquer à distance depuis cet agent.

BEGIN;

-- Table créée
SELECT to_regclass('public.presented_help_events') IS NOT NULL AS table_exists;

-- Colonnes d’ancrage
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'presented_help_events'
  AND column_name IN ('eleve_id', 'devoir_id', 'exercice_id', 'item_id', 'tentative_id', 'session_id', 'kind')
ORDER BY column_name;

-- Index d’idempotence
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'presented_help_events'
  AND indexname = 'presented_help_events_dedupe_idx';

ROLLBACK;
