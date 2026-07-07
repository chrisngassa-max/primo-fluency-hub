-- Lien séances formateur (sessions) ↔ plan curriculum v2 (training_sessions)
BEGIN;

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS training_session_id uuid
    REFERENCES public.training_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS curriculum_palier_cible text
    CHECK (curriculum_palier_cible IS NULL OR curriculum_palier_cible IN ('A2', 'B1', 'B2'));

CREATE INDEX IF NOT EXISTS idx_sessions_training_session
  ON public.sessions (training_session_id)
  WHERE training_session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_group_training_session
  ON public.sessions (group_id, training_session_id)
  WHERE training_session_id IS NOT NULL;

COMMENT ON COLUMN public.sessions.training_session_id IS
  'Référence vers une séance du plan maître curriculum v2 (S01–S37, E1–E4).';
COMMENT ON COLUMN public.sessions.curriculum_palier_cible IS
  'Palier cible des variantes d''exercices (A2/B1/B2). Distinct du n° de séance et du niveau actuel des élèves.';

COMMIT;
