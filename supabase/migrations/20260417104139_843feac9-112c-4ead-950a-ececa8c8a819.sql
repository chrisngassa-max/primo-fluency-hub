-- 1) Index uniques pleins (Postgres autorise déjà plusieurs NULL)
CREATE UNIQUE INDEX IF NOT EXISTS exercise_assignments_source_devoir_uidx
  ON public.exercise_assignments (source_devoir_id);

CREATE UNIQUE INDEX IF NOT EXISTS exercise_attempts_source_resultat_uidx
  ON public.exercise_attempts (source_resultat_id);

-- 2) (Re)attacher les triggers miroir (sens unique Primo → Connect)
DROP TRIGGER IF EXISTS trg_mirror_devoir_to_assignment ON public.devoirs;
CREATE TRIGGER trg_mirror_devoir_to_assignment
AFTER INSERT OR UPDATE ON public.devoirs
FOR EACH ROW EXECUTE FUNCTION public.mirror_devoir_to_assignment();

DROP TRIGGER IF EXISTS trg_mirror_resultat_to_attempt ON public.resultats;
CREATE TRIGGER trg_mirror_resultat_to_attempt
AFTER INSERT ON public.resultats
FOR EACH ROW EXECUTE FUNCTION public.mirror_resultat_to_attempt();

-- 3) Backfill devoirs → exercise_assignments
INSERT INTO public.exercise_assignments
  (exercise_id, learner_id, assigned_by, context, due_date, sync_status, source_devoir_id)
SELECT d.exercice_id, d.eleve_id, d.formateur_id, 'devoir', d.date_echeance, 'primo', d.id
FROM public.devoirs d
ON CONFLICT (source_devoir_id) DO NOTHING;

-- 4) Backfill resultats → exercise_attempts
INSERT INTO public.exercise_attempts
  (exercise_id, learner_id, assignment_id, answers, score_normalized,
   source_app, completed_at, source_resultat_id)
SELECT
  r.exercice_id,
  r.eleve_id,
  ea.id,
  r.reponses_eleve,
  CASE WHEN r.score > 1 THEN r.score / 100.0 ELSE r.score END,
  'primo',
  COALESCE(r.created_at, now()),
  r.id
FROM public.resultats r
LEFT JOIN public.exercise_assignments ea ON ea.source_devoir_id = r.devoir_id
ON CONFLICT (source_resultat_id) DO NOTHING;