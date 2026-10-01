-- Disable the automatic frontend path BEFORE rollback. No direct-insert fallback.
-- Receipts must be retained for idempotence. Refuse destruction of nonempty receipts.
-- No exercise, homework, assignment or historical content is deleted by this script.
BEGIN;
LOCK TABLE homework_private.receipts IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM homework_private.receipts) THEN
   RAISE EXCEPTION 'p0_rollback_refused_nonempty_receipts: preserve receipts and disable automatic sending before an explicitly reviewed retention plan';
 END IF;
END $$;
DROP FUNCTION public.send_automatic_homework(uuid,uuid,uuid,timestamptz,jsonb);
DROP TRIGGER p0_guard_assignment ON public.devoirs;
DROP TRIGGER p0_guard_exercise ON public.exercices;
DROP TRIGGER p0_guard_independent_assignment ON public.exercise_assignments;
ALTER TABLE public.exercise_assignments DROP CONSTRAINT p0_assignment_executable_fk;
ALTER TABLE public.exercise_assignments DROP CONSTRAINT p0_assignment_requires_true;
ALTER TABLE public.exercise_assignments DROP COLUMN p0_requires_executable;
ALTER TABLE public.devoirs DROP CONSTRAINT p0_homework_executable_fk;
ALTER TABLE public.devoirs DROP CONSTRAINT p0_homework_requires_true;
ALTER TABLE public.devoirs DROP COLUMN p0_requires_executable;
ALTER TABLE public.exercices DROP CONSTRAINT p0_homework_exercise_key;
ALTER TABLE public.exercices DROP COLUMN p0_homework_executable;
DROP FUNCTION homework_private.guard_assignment();
DROP FUNCTION homework_private.guard_exercise();
DROP FUNCTION homework_private.guard_independent_assignment();
DROP FUNCTION homework_private.lock_exercises(uuid[]);
DROP FUNCTION homework_private.audio_available(jsonb);
DROP FUNCTION homework_private.executable(jsonb);
DROP FUNCTION homework_private.has_text(jsonb);
DROP TABLE homework_private.receipts;
DROP SCHEMA homework_private;
COMMIT;
