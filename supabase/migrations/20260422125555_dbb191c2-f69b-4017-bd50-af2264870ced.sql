CREATE OR REPLACE FUNCTION public.mirror_resultat_to_attempt()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_assignment_id uuid;
  v_score numeric;
  v_completed_at timestamptz;
  v_existing_id uuid;
begin
  select ea.id into v_assignment_id
  from public.exercise_assignments ea
  where ea.source_devoir_id = NEW.devoir_id
  limit 1;

  v_score := case when NEW.score > 1 then NEW.score / 100.0 else NEW.score end;
  v_completed_at := coalesce(NEW.created_at, now());

  select id into v_existing_id
  from public.exercise_attempts
  where exercise_id = NEW.exercice_id
    and learner_id = NEW.eleve_id
    and status = 'in_progress'
  order by created_at desc
  limit 1;

  if v_existing_id is not null then
    update public.exercise_attempts
    set
      assignment_id = coalesce(assignment_id, v_assignment_id),
      answers = NEW.reponses_eleve,
      score_normalized = v_score,
      status = 'completed',
      completed_at = v_completed_at,
      source_resultat_id = NEW.id,
      source_app = 'primo'
    where id = v_existing_id;
  else
    insert into public.exercise_attempts (
      exercise_id,
      learner_id,
      assignment_id,
      answers,
      score_normalized,
      status,
      source_app,
      started_at,
      completed_at,
      source_resultat_id
    ) values (
      NEW.exercice_id,
      NEW.eleve_id,
      v_assignment_id,
      NEW.reponses_eleve,
      v_score,
      'completed',
      'primo',
      v_completed_at,
      v_completed_at,
      NEW.id
    )
    on conflict (source_resultat_id) do update set
      answers = excluded.answers,
      score_normalized = excluded.score_normalized,
      status = 'completed',
      completed_at = excluded.completed_at;
  end if;

  return NEW;
end $function$;

UPDATE public.exercise_attempts ea
SET status = 'completed'
WHERE ea.status = 'in_progress'
  AND ea.completed_at IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.resultats r
    WHERE r.exercice_id = ea.exercise_id
      AND r.eleve_id = ea.learner_id
      AND r.created_at <= ea.completed_at + interval '5 seconds'
      AND r.created_at >= ea.completed_at - interval '5 seconds'
  );