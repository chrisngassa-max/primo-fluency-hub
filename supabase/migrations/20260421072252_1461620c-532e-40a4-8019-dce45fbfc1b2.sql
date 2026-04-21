-- Deduplicate in-progress attempts: keep latest per (exercise_id, learner_id)
DELETE FROM public.exercise_attempts a
USING public.exercise_attempts b
WHERE a.status = 'in_progress'
  AND b.status = 'in_progress'
  AND a.exercise_id = b.exercise_id
  AND a.learner_id = b.learner_id
  AND a.created_at < b.created_at;

-- Edge case: identical created_at — keep one arbitrarily by id
DELETE FROM public.exercise_attempts a
USING public.exercise_attempts b
WHERE a.status = 'in_progress'
  AND b.status = 'in_progress'
  AND a.exercise_id = b.exercise_id
  AND a.learner_id = b.learner_id
  AND a.created_at = b.created_at
  AND a.id < b.id;

CREATE UNIQUE INDEX IF NOT EXISTS exercise_attempts_in_progress_unique
ON public.exercise_attempts (exercise_id, learner_id)
WHERE status = 'in_progress';

ALTER TABLE public.exercise_attempts ALTER COLUMN status SET DEFAULT 'in_progress';