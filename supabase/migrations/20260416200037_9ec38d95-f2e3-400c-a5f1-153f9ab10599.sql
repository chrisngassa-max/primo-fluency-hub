-- Fix 1: trigger mirror_devoir_to_assignment used non-existent column "assigned_to"
-- The actual column is "learner_id". This was crashing on every devoir insert.
CREATE OR REPLACE FUNCTION public.mirror_devoir_to_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  insert into public.exercise_assignments (
    exercise_id, learner_id, assigned_by, context, due_date, sync_status, source_devoir_id
  ) values (
    NEW.exercice_id, NEW.eleve_id, NEW.formateur_id, 'devoir', NEW.date_echeance, 'primo', NEW.id
  )
  on conflict (source_devoir_id) do update set
    exercise_id = excluded.exercise_id,
    learner_id = excluded.learner_id,
    assigned_by = excluded.assigned_by,
    due_date = excluded.due_date;
  return NEW;
end $function$;