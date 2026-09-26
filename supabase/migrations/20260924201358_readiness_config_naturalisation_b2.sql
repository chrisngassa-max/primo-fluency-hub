-- LOT 3A Phase B — readiness_config IRN 2026
-- naturalisation = B2 ; résident = B1 ; pluriannuelle = A2
-- Cible : UPDATE jsonb UNIQUEMENT sur readiness_config active algo_version=1
-- Aucune table/fonction/policy ; aucun profil/snapshot/résultat

BEGIN;

DO $$
DECLARE
  v_id uuid;
  v_cfg jsonb;
  v_obj jsonb;
  v_updated int;
BEGIN
  SELECT id, config
    INTO v_id, v_cfg
  FROM public.readiness_config
  WHERE active = true
    AND algo_version = 1
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_id IS NULL THEN
    RAISE EXCEPTION
      'lot3a_phase_b: aucune readiness_config active algo_version=1';
  END IF;

  v_obj := v_cfg -> 'objectifs';

  -- Idempotent : déjà aligné B2
  IF (v_obj ? 'B2')
     AND (v_obj -> 'B2' ->> 'libelle') = 'Naturalisation'
     AND (v_obj -> 'B2' ->> 'niveau_requis_scale') = '10'
     AND (v_obj -> 'B1' ->> 'libelle') = 'Carte de résident'
     AND (v_obj -> 'A2' ->> 'libelle') = 'Carte de séjour pluriannuelle'
  THEN
    RAISE NOTICE
      'lot3a_phase_b: déjà appliqué (id=%), skip',
      v_id;
    RETURN;
  END IF;

  -- Garde préflight : état distant attendu (bug B1 naturalisation, sans B2)
  IF (v_obj -> 'B1' ->> 'libelle') IS DISTINCT FROM 'Naturalisation'
     OR (v_obj -> 'B1' ->> 'niveau_requis_scale') IS DISTINCT FROM '7'
     OR (v_obj -> 'A2' ->> 'libelle') IS DISTINCT FROM 'Carte de résident'
     OR (v_obj -> 'A2' ->> 'niveau_requis_scale') IS DISTINCT FROM '4'
     OR (v_obj ? 'B2')
  THEN
    RAISE EXCEPTION
      'lot3a_phase_b: état distant ≠ préflight (objectifs=%)',
      v_obj;
  END IF;

  -- Objectifs IRN 2026
  v_cfg := jsonb_set(
    v_cfg,
    '{objectifs}',
    jsonb_build_object(
      '_comment',
      'L''objectif est lu depuis parcours.niveau_cible (+ parcours.type_demarche), jamais posé en dur par groupe. Règle IRN 2026-01-01 : pluriannuelle=A2, résident=B1, naturalisation=B2 (Service-Public F11926).',
      'A2',
      jsonb_build_object(
        'libelle', 'Carte de séjour pluriannuelle',
        'niveau_requis_scale', 4
      ),
      'B1',
      jsonb_build_object(
        'libelle', 'Carte de résident',
        'niveau_requis_scale', 7
      ),
      'B2',
      jsonb_build_object(
        'libelle', 'Naturalisation',
        'niveau_requis_scale', 10
      )
    ),
    true
  );

  -- Seuils B2 directement nécessaires au moteur IPE
  v_cfg := jsonb_set(
    v_cfg,
    '{structural_moderator,fragile_threshold_by_objectif}',
    (COALESCE(v_cfg #> '{structural_moderator,fragile_threshold_by_objectif}', '{}'::jsonb)
      || jsonb_build_object('B2', 70)),
    true
  );

  v_cfg := jsonb_set(
    v_cfg,
    '{maitrise_periode,min_success_rate_by_objectif}',
    (COALESCE(v_cfg #> '{maitrise_periode,min_success_rate_by_objectif}', '{}'::jsonb)
      || jsonb_build_object('B2', 70)),
    true
  );

  v_cfg := jsonb_set(
    v_cfg,
    '{structures_socle,min_success_rate_by_objectif}',
    (COALESCE(v_cfg #> '{structures_socle,min_success_rate_by_objectif}', '{}'::jsonb)
      || jsonb_build_object('B2', 70)),
    true
  );

  v_cfg := jsonb_set(
    v_cfg,
    '{structures_socle,priorites_B2}',
    jsonb_build_array(
      'argumentation structurée (thèse / arguments / conclusion)',
      'hypothèse et concession (si, même si, bien que)',
      'registre soutenu adapté à l''entretien de naturalisation',
      'connecteurs d''opposition et de cause complexes'
    ),
    true
  );

  UPDATE public.readiness_config
  SET config = v_cfg
  WHERE id = v_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION
      'lot3a_phase_b: UPDATE inattendu (rows=%)',
      v_updated;
  END IF;
END $$;

COMMIT;
