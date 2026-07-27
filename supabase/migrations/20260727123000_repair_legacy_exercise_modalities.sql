begin;

alter table public.exercices disable trigger trg_enforce_exercise_modality;

update public.exercices
set format = 'production_ecrite'
where upper(competence::text) = 'EE'
  and lower(coalesce(format::text, '')) <> 'production_ecrite';

update public.exercices
set format = 'production_orale'
where upper(competence::text) = 'EO'
  and lower(coalesce(format::text, '')) <> 'production_orale';

-- Reprend les scripts audio stockés dans les anciens items.
with candidates as (
  select distinct on (e.id)
    e.id,
    coalesce(
      nullif(item->>'script_audio', ''),
      nullif(item->>'audio_script', ''),
      nullif(item->>'support_audio', '')
    ) as script
  from public.exercices e
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(e.contenu->'items') = 'array' then e.contenu->'items'
      else '[]'::jsonb
    end
  ) item
  where upper(e.competence::text) = 'CO'
    and coalesce(
      nullif(e.contenu->>'script_audio', ''),
      nullif(e.contenu->>'audio_script', ''),
      nullif(e.contenu->>'support_audio', ''),
      nullif(e.contenu->>'audio_url', ''),
      nullif(e.contenu->>'url_audio', ''),
      nullif(e.contenu->>'audio_src', '')
    ) is null
    and coalesce(
      nullif(item->>'script_audio', ''),
      nullif(item->>'audio_script', ''),
      nullif(item->>'support_audio', '')
    ) is not null
  order by e.id
)
update public.exercices e
set contenu = jsonb_set(coalesce(e.contenu, '{}'::jsonb), '{script_audio}', to_jsonb(c.script), true)
from candidates c
where e.id = c.id;

-- Reprend de la même façon les anciennes URL audio imbriquées.
with candidates as (
  select distinct on (e.id)
    e.id,
    coalesce(
      nullif(item->>'audio_url', ''),
      nullif(item->>'url_audio', ''),
      nullif(item->>'audio_src', '')
    ) as audio_url
  from public.exercices e
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(e.contenu->'items') = 'array' then e.contenu->'items'
      else '[]'::jsonb
    end
  ) item
  where upper(e.competence::text) = 'CO'
    and coalesce(
      nullif(e.contenu->>'script_audio', ''),
      nullif(e.contenu->>'audio_script', ''),
      nullif(e.contenu->>'support_audio', ''),
      nullif(e.contenu->>'audio_url', ''),
      nullif(e.contenu->>'url_audio', ''),
      nullif(e.contenu->>'audio_src', '')
    ) is null
    and coalesce(
      nullif(item->>'audio_url', ''),
      nullif(item->>'url_audio', ''),
      nullif(item->>'audio_src', '')
    ) is not null
  order by e.id
)
update public.exercices e
set contenu = jsonb_set(coalesce(e.contenu, '{}'::jsonb), '{audio_url}', to_jsonb(c.audio_url), true)
from candidates c
where e.id = c.id;

-- Conserve mais met hors diffusion tout contenu encore incomplet.
update public.exercices e
set
  is_live_ready = false,
  validation_status = 'rejected',
  validation_score = 0,
  validation_issues = to_jsonb(public.exercise_modality_issues(
    e.titre,
    e.consigne,
    e.competence::text,
    e.format::text,
    e.contenu
  )),
  validation_checked_at = now(),
  validation_profile = 'generated_strict',
  validation_source = 'backfill'
where cardinality(public.exercise_modality_issues(
  e.titre,
  e.consigne,
  e.competence::text,
  e.format::text,
  e.contenu
)) > 0;

alter table public.exercices enable trigger trg_enforce_exercise_modality;

commit;
