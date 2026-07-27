-- Empêche toute création ou publication d'un exercice dont le rendu élève
-- ne peut pas fournir l'interaction indispensable à sa compétence.

create or replace function public.exercise_modality_issues(
  p_titre text,
  p_consigne text,
  p_competence text,
  p_format text,
  p_contenu jsonb
)
returns text[]
language plpgsql
immutable
set search_path = public
as $$
declare
  issues text[] := array[]::text[];
  c jsonb := coalesce(p_contenu, '{}'::jsonb);
  items jsonb := coalesce(c->'items', '[]'::jsonb);
  audio_support text;
  reading_support text;
begin
  if nullif(btrim(coalesce(p_titre, '')), '') is null then
    issues := array_append(issues, 'Le titre est obligatoire.');
  end if;
  if nullif(btrim(coalesce(p_consigne, '')), '') is null then
    issues := array_append(issues, 'La consigne est obligatoire.');
  end if;

  audio_support := coalesce(
    nullif(btrim(c->>'script_audio'), ''),
    nullif(btrim(c->>'audio_script'), ''),
    nullif(btrim(c->>'support_audio'), ''),
    nullif(btrim(c->>'audio_url'), ''),
    nullif(btrim(c->>'url_audio'), ''),
    nullif(btrim(c->>'audio_src'), '')
  );

  reading_support := coalesce(
    nullif(btrim(c->>'texte'), ''),
    nullif(btrim(c->>'texte_support'), ''),
    nullif(btrim(c->>'support_texte'), ''),
    nullif(btrim(c->>'document'), ''),
    nullif(btrim(c->>'support'), ''),
    nullif(btrim(c->>'enonce'), ''),
    nullif(btrim(c->>'contexte'), '')
  );

  if upper(coalesce(p_competence, '')) = 'CO' then
    if audio_support is null then
      issues := array_append(issues, 'CO : ajoutez un script ou un fichier audio pour afficher le bouton d''écoute.');
    end if;
    if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) = 0 then
      issues := array_append(issues, 'CO : ajoutez au moins une question.');
    end if;
  elsif upper(coalesce(p_competence, '')) = 'CE' then
    if reading_support is null or length(reading_support) < 20 then
      issues := array_append(issues, 'CE : ajoutez le texte support visible par l''élève.');
    end if;
    if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) = 0 then
      issues := array_append(issues, 'CE : ajoutez au moins une question.');
    end if;
  elsif upper(coalesce(p_competence, '')) = 'EE' then
    if lower(coalesce(p_format, '')) <> 'production_ecrite' then
      issues := array_append(issues, 'EE : le format production_ecrite est obligatoire pour afficher la zone de rédaction.');
    end if;
  elsif upper(coalesce(p_competence, '')) = 'EO' then
    if lower(coalesce(p_format, '')) <> 'production_orale' then
      issues := array_append(issues, 'EO : le format production_orale est obligatoire pour afficher l''enregistreur.');
    end if;
  end if;

  return issues;
end;
$$;

create or replace function public.enforce_exercise_modality()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  issues text[];
begin
  issues := public.exercise_modality_issues(
    new.titre,
    new.consigne,
    new.competence::text,
    new.format::text,
    new.contenu
  );
  if cardinality(issues) > 0 then
    raise exception using
      errcode = '23514',
      message = 'Exercice refusé : ' || array_to_string(issues, ' ');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_exercise_modality on public.exercices;
create trigger trg_enforce_exercise_modality
before insert or update of titre, consigne, competence, format, contenu, is_live_ready
on public.exercices
for each row
execute function public.enforce_exercise_modality();
