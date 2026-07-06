-- CapTCF — Seed curriculum v2 plan + sessions from manifest.json
-- Idempotent: safe to re-run. Does not touch cohort pins, batches, or published resources.

BEGIN;

DO $$
DECLARE
  v_plan_id uuid;
BEGIN
  INSERT INTO public.training_plan_versions (version, statut, notes, activated_at)
  VALUES (
    'curriculum-v2.0',
    'active',
    'Manifest plan_version 2026-07-05 (generated 2026-07-05T00:00:00.000Z)',
    now()
  )
  ON CONFLICT (version) DO UPDATE SET
    statut = 'active',
    notes = EXCLUDED.notes,
    activated_at = COALESCE(public.training_plan_versions.activated_at, EXCLUDED.activated_at),
    updated_at = now()
  RETURNING id INTO v_plan_id;

  IF v_plan_id IS NULL THEN
    SELECT id INTO v_plan_id FROM public.training_plan_versions WHERE version = 'curriculum-v2.0' LIMIT 1;
  END IF;

  INSERT INTO public.training_sessions (
    plan_version_id, code, ordre, kind, module, palier, type_seance, duree_minutes,
    titre, objectifs, competences, civic_theme, civic_mention, source_ids, statut
  ) VALUES (
    v_plan_id,
    'S01',
    1,
    'session',
    'A',
    'A2',
    'mixte, diagnostic non certificatif',
    180,
    'Accueil, objectifs et cinq thèmes',
    '["Présenter le parcours cumulatif A2/B1/B2 et les cinq thèmes civiques","Réaliser un diagnostic non certificatif A1-B2","Distinguer droit, devoir et règle"]'::jsonb,
    ARRAY['CO', 'EO'],
    'Droits et devoirs',
    'CSP',
    ARRAY[]::text[],
    'planned'
  )
  ON CONFLICT (plan_version_id, code) DO UPDATE SET
    ordre = EXCLUDED.ordre,
    kind = EXCLUDED.kind,
    module = EXCLUDED.module,
    palier = EXCLUDED.palier,
    type_seance = EXCLUDED.type_seance,
    duree_minutes = EXCLUDED.duree_minutes,
    titre = EXCLUDED.titre,
    objectifs = EXCLUDED.objectifs,
    competences = EXCLUDED.competences,
    civic_theme = EXCLUDED.civic_theme,
    civic_mention = EXCLUDED.civic_mention,
    source_ids = EXCLUDED.source_ids,
    statut = CASE WHEN public.training_sessions.statut IN ('published', 'publishable')
      THEN public.training_sessions.statut
      ELSE EXCLUDED.statut
    END,
    updated_at = now();

  INSERT INTO public.training_sessions (
    plan_version_id, code, ordre, kind, module, palier, type_seance, duree_minutes,
    titre, objectifs, competences, civic_theme, civic_mention, source_ids, statut
  ) VALUES (
    v_plan_id,
    'S02',
    2,
    'session',
    'A',
    'A2',
    'mixte',
    180,
    'État civil, mairie et symboles',
    '["Compléter un formulaire fictif d''état civil et échanger avec une mairie","Identifier République, devise, langue, fête nationale et symboles"]'::jsonb,
    ARRAY['CE', 'EE'],
    'Principes et valeurs de la République',
    'CSP',
    ARRAY[]::text[],
    'planned'
  )
  ON CONFLICT (plan_version_id, code) DO UPDATE SET
    ordre = EXCLUDED.ordre,
    kind = EXCLUDED.kind,
    module = EXCLUDED.module,
    palier = EXCLUDED.palier,
    type_seance = EXCLUDED.type_seance,
    duree_minutes = EXCLUDED.duree_minutes,
    titre = EXCLUDED.titre,
    objectifs = EXCLUDED.objectifs,
    competences = EXCLUDED.competences,
    civic_theme = EXCLUDED.civic_theme,
    civic_mention = EXCLUDED.civic_mention,
    source_ids = EXCLUDED.source_ids,
    statut = CASE WHEN public.training_sessions.statut IN ('published', 'publishable')
      THEN public.training_sessions.statut
      ELSE EXCLUDED.statut
    END,
    updated_at = now();

  INSERT INTO public.training_sessions (
    plan_version_id, code, ordre, kind, module, palier, type_seance, duree_minutes,
    titre, objectifs, competences, civic_theme, civic_mention, source_ids, statut
  ) VALUES (
    v_plan_id,
    'S03',
    3,
    'session',
    'A',
    'A2',
    'mixte',
    180,
    'Santé et urgences',
    '["Décrire des symptômes et choisir l''interlocuteur adapté (urgence ou non)","Connaître l''accès aux soins, le médecin traitant et la carte Vitale"]'::jsonb,
    ARRAY['CO', 'EO'],
    'Vivre dans la société française',
    'CSP',
    ARRAY[]::text[],
    'planned'
  )
  ON CONFLICT (plan_version_id, code) DO UPDATE SET
    ordre = EXCLUDED.ordre,
    kind = EXCLUDED.kind,
    module = EXCLUDED.module,
    palier = EXCLUDED.palier,
    type_seance = EXCLUDED.type_seance,
    duree_minutes = EXCLUDED.duree_minutes,
    titre = EXCLUDED.titre,
    objectifs = EXCLUDED.objectifs,
    competences = EXCLUDED.competences,
    civic_theme = EXCLUDED.civic_theme,
    civic_mention = EXCLUDED.civic_mention,
    source_ids = EXCLUDED.source_ids,
    statut = CASE WHEN public.training_sessions.statut IN ('published', 'publishable')
      THEN public.training_sessions.statut
      ELSE EXCLUDED.statut
    END,
    updated_at = now();

  INSERT INTO public.training_sessions (
    plan_version_id, code, ordre, kind, module, palier, type_seance, duree_minutes,
    titre, objectifs, competences, civic_theme, civic_mention, source_ids, statut
  ) VALUES (
    v_plan_id,
    'S04',
    4,
    'session',
    'A',
    'A2',
    'dominante civique intégrée',
    180,
    'École, absence et autorité parentale',
    '["Expliquer et justifier une absence scolaire par écrit","Connaître l''instruction obligatoire, l''école publique, l''autorité parentale et la laïcité"]'::jsonb,
    ARRAY['CE', 'EE'],
    'Droits et devoirs',
    'CSP',
    ARRAY[]::text[],
    'planned'
  )
  ON CONFLICT (plan_version_id, code) DO UPDATE SET
    ordre = EXCLUDED.ordre,
    kind = EXCLUDED.kind,
    module = EXCLUDED.module,
    palier = EXCLUDED.palier,
    type_seance = EXCLUDED.type_seance,
    duree_minutes = EXCLUDED.duree_minutes,
    titre = EXCLUDED.titre,
    objectifs = EXCLUDED.objectifs,
    competences = EXCLUDED.competences,
    civic_theme = EXCLUDED.civic_theme,
    civic_mention = EXCLUDED.civic_mention,
    source_ids = EXCLUDED.source_ids,
    statut = CASE WHEN public.training_sessions.statut IN ('published', 'publishable')
      THEN public.training_sessions.statut
      ELSE EXCLUDED.statut
    END,
    updated_at = now();

  INSERT INTO public.training_sessions (
    plan_version_id, code, ordre, kind, module, palier, type_seance, duree_minutes,
    titre, objectifs, competences, civic_theme, civic_mention, source_ids, statut
  ) VALUES (
    v_plan_id,
    'S05',
    5,
    'session',
    'A',
    'A2',
    'mixte',
    180,
    'Logement, voisinage et discrimination',
    '["Signaler un conflit de voisinage et proposer une solution légale","Mobiliser égalité, fraternité, associations et recours face à la discrimination"]'::jsonb,
    ARRAY['CO', 'EO'],
    'Droits et devoirs',
    'CSP',
    ARRAY[]::text[],
    'planned'
  )
  ON CONFLICT (plan_version_id, code) DO UPDATE SET
    ordre = EXCLUDED.ordre,
    kind = EXCLUDED.kind,
    module = EXCLUDED.module,
    palier = EXCLUDED.palier,
    type_seance = EXCLUDED.type_seance,
    duree_minutes = EXCLUDED.duree_minutes,
    titre = EXCLUDED.titre,
    objectifs = EXCLUDED.objectifs,
    competences = EXCLUDED.competences,
    civic_theme = EXCLUDED.civic_theme,
    civic_mention = EXCLUDED.civic_mention,
    source_ids = EXCLUDED.source_ids,
    statut = CASE WHEN public.training_sessions.statut IN ('published', 'publishable')
      THEN public.training_sessions.statut
      ELSE EXCLUDED.statut
    END,
    updated_at = now();

  INSERT INTO public.training_sessions (
    plan_version_id, code, ordre, kind, module, palier, type_seance, duree_minutes,
    titre, objectifs, competences, civic_theme, civic_mention, source_ids, statut
  ) VALUES (
    v_plan_id,
    'S06',
    6,
    'session',
    'B',
    'A2',
    'mixte',
    180,
    'Emploi, contrat et fiche de paie',
    '["Vérifier une offre, un contrat et une fiche de paie cohérents","Connaître le travail déclaré, la durée légale et l''égalité professionnelle"]'::jsonb,
    ARRAY['CE', 'structures'],
    'Vivre dans la société française',
    'CSP',
    ARRAY[]::text[],
    'planned'
  )
  ON CONFLICT (plan_version_id, code) DO UPDATE SET
    ordre = EXCLUDED.ordre,
    kind = EXCLUDED.kind,
    module = EXCLUDED.module,
    palier = EXCLUDED.palier,
    type_seance = EXCLUDED.type_seance,
    duree_minutes = EXCLUDED.duree_minutes,
    titre = EXCLUDED.titre,
    objectifs = EXCLUDED.objectifs,
    competences = EXCLUDED.competences,
    civic_theme = EXCLUDED.civic_theme,
    civic_mention = EXCLUDED.civic_mention,
    source_ids = EXCLUDED.source_ids,
    statut = CASE WHEN public.training_sessions.statut IN ('published', 'publishable')
      THEN public.training_sessions.statut
      ELSE EXCLUDED.statut
    END,
    updated_at = now();

  INSERT INTO public.training_sessions (
    plan_version_id, code, ordre, kind, module, palier, type_seance, duree_minutes,
    titre, objectifs, competences, civic_theme, civic_mention, source_ids, statut
  ) VALUES (
    v_plan_id,
    'S07',
    7,
    'session',
    'B',
    'A2',
    'mixte',
    180,
    'Préfecture, notification et rendez-vous',
    '["Écrire un courriel formel à la préfecture et joindre la bonne pièce","Comprendre loi, administration, service public et droits de l''usager"]'::jsonb,
    ARRAY['CE', 'EE'],
    'Droits et devoirs',
    'CSP',
    ARRAY[]::text[],
    'planned'
  )
  ON CONFLICT (plan_version_id, code) DO UPDATE SET
    ordre = EXCLUDED.ordre,
    kind = EXCLUDED.kind,
    module = EXCLUDED.module,
    palier = EXCLUDED.palier,
    type_seance = EXCLUDED.type_seance,
    duree_minutes = EXCLUDED.duree_minutes,
    titre = EXCLUDED.titre,
    objectifs = EXCLUDED.objectifs,
    competences = EXCLUDED.competences,
    civic_theme = EXCLUDED.civic_theme,
    civic_mention = EXCLUDED.civic_mention,
    source_ids = EXCLUDED.source_ids,
    statut = CASE WHEN public.training_sessions.statut IN ('published', 'publishable')
      THEN public.training_sessions.statut
      ELSE EXCLUDED.statut
    END,
    updated_at = now();

  INSERT INTO public.training_sessions (
    plan_version_id, code, ordre, kind, module, palier, type_seance, duree_minutes,
    titre, objectifs, competences, civic_theme, civic_mention, source_ids, statut
  ) VALUES (
    v_plan_id,
    'S08',
    8,
    'session',
    'B',
    'A2',
    'dominante civique',
    180,
    'Ve République et Constitution',
    '["Expliquer simplement ce qu''organise la Constitution de 1958","Connaître la Ve République et l''État de droit"]'::jsonb,
    ARRAY['CO', 'CE'],
    'Système institutionnel et politique',
    'CSP',
    ARRAY[]::text[],
    'planned'
  )
  ON CONFLICT (plan_version_id, code) DO UPDATE SET
    ordre = EXCLUDED.ordre,
    kind = EXCLUDED.kind,
    module = EXCLUDED.module,
    palier = EXCLUDED.palier,
    type_seance = EXCLUDED.type_seance,
    duree_minutes = EXCLUDED.duree_minutes,
    titre = EXCLUDED.titre,
    objectifs = EXCLUDED.objectifs,
    competences = EXCLUDED.competences,
    civic_theme = EXCLUDED.civic_theme,
    civic_mention = EXCLUDED.civic_mention,
    source_ids = EXCLUDED.source_ids,
    statut = CASE WHEN public.training_sessions.statut IN ('published', 'publishable')
      THEN public.training_sessions.statut
      ELSE EXCLUDED.statut
    END,
    updated_at = now();

  INSERT INTO public.training_sessions (
    plan_version_id, code, ordre, kind, module, palier, type_seance, duree_minutes,
    titre, objectifs, competences, civic_theme, civic_mention, source_ids, statut
  ) VALUES (
    v_plan_id,
    'S09',
    9,
    'session',
    'B',
    'A2',
    'dominante civique',
    180,
    'Laïcité en situations',
    '["Expliquer une règle de laïcité et justifier une conduite dans quatre situations","Distinguer liberté de conscience et neutralité de l''État"]'::jsonb,
    ARRAY['EO', 'EE'],
    'Principes et valeurs de la République',
    'CSP',
    ARRAY[]::text[],
    'planned'
  )
  ON CONFLICT (plan_version_id, code) DO UPDATE SET
    ordre = EXCLUDED.ordre,
    kind = EXCLUDED.kind,
    module = EXCLUDED.module,
    palier = EXCLUDED.palier,
    type_seance = EXCLUDED.type_seance,
    duree_minutes = EXCLUDED.duree_minutes,
    titre = EXCLUDED.titre,
    objectifs = EXCLUDED.objectifs,
    competences = EXCLUDED.competences,
    civic_theme = EXCLUDED.civic_theme,
    civic_mention = EXCLUDED.civic_mention,
    source_ids = EXCLUDED.source_ids,
    statut = CASE WHEN public.training_sessions.statut IN ('published', 'publishable')
      THEN public.training_sessions.statut
      ELSE EXCLUDED.statut
    END,
    updated_at = now();

  INSERT INTO public.training_sessions (
    plan_version_id, code, ordre, kind, module, palier, type_seance, duree_minutes,
    titre, objectifs, competences, civic_theme, civic_mention, source_ids, statut
  ) VALUES (
    v_plan_id,
    'S10',
    10,
    'session',
    'B',
    'A2',
    'dominante civique',
    180,
    'Du local au national : qui fait quoi ?',
    '["Orienter une demande d''habitant vers la bonne institution","Distinguer les rôles du local (commune) au national (président, Parlement, justice)"]'::jsonb,
    ARRAY['CO', 'CE'],
    'Système institutionnel et politique',
    'CSP',
    ARRAY[]::text[],
    'planned'
  )
  ON CONFLICT (plan_version_id, code) DO UPDATE SET
    ordre = EXCLUDED.ordre,
    kind = EXCLUDED.kind,
    module = EXCLUDED.module,
    palier = EXCLUDED.palier,
    type_seance = EXCLUDED.type_seance,
    duree_minutes = EXCLUDED.duree_minutes,
    titre = EXCLUDED.titre,
    objectifs = EXCLUDED.objectifs,
    competences = EXCLUDED.competences,
    civic_theme = EXCLUDED.civic_theme,
    civic_mention = EXCLUDED.civic_mention,
    source_ids = EXCLUDED.source_ids,
    statut = CASE WHEN public.training_sessions.statut IN ('published', 'publishable')
      THEN public.training_sessions.statut
      ELSE EXCLUDED.statut
    END,
    updated_at = now();

  INSERT INTO public.training_sessions (
    plan_version_id, code, ordre, kind, module, palier, type_seance, duree_minutes,
    titre, objectifs, competences, civic_theme, civic_mention, source_ids, statut
  ) VALUES (
    v_plan_id,
    'S11',
    11,
    'session',
    'C',
    'A2',
    'mixte',
    180,
    'Police, gendarmerie et justice',
    '["Raconter les faits d''un vol et orienter la personne vers police, gendarmerie ou justice","Connaître le droit de se défendre"]'::jsonb,
    ARRAY['CE', 'EO'],
    'Droits et devoirs',
    'CSP',
    ARRAY[]::text[],
    'planned'
  )
  ON CONFLICT (plan_version_id, code) DO UPDATE SET
    ordre = EXCLUDED.ordre,
    kind = EXCLUDED.kind,
    module = EXCLUDED.module,
    palier = EXCLUDED.palier,
    type_seance = EXCLUDED.type_seance,
    duree_minutes = EXCLUDED.duree_minutes,
    titre = EXCLUDED.titre,
    objectifs = EXCLUDED.objectifs,
    competences = EXCLUDED.competences,
    civic_theme = EXCLUDED.civic_theme,
    civic_mention = EXCLUDED.civic_mention,
    source_ids = EXCLUDED.source_ids,
    statut = CASE WHEN public.training_sessions.statut IN ('published', 'publishable')
      THEN public.training_sessions.statut
      ELSE EXCLUDED.statut
    END,
    updated_at = now();

  INSERT INTO public.training_sessions (
    plan_version_id, code, ordre, kind, module, palier, type_seance, duree_minutes,
    titre, objectifs, competences, civic_theme, civic_mention, source_ids, statut
  ) VALUES (
    v_plan_id,
    'S12',
    12,
    'session',
    'C',
    'A2',
    'dominante civique',
    180,
    'Discriminations, violences et protection',
    '["Rédiger un message de signalement factuel d''une discrimination","Connaître l''égalité femmes-hommes, la dignité et la protection"]'::jsonb,
    ARRAY['CO', 'EE'],
    'Droits et devoirs',
    'CSP',
    ARRAY[]::text[],
    'planned'
  )
  ON CONFLICT (plan_version_id, code) DO UPDATE SET
    ordre = EXCLUDED.ordre,
    kind = EXCLUDED.kind,
    module = EXCLUDED.module,
    palier = EXCLUDED.palier,
    type_seance = EXCLUDED.type_seance,
    duree_minutes = EXCLUDED.duree_minutes,
    titre = EXCLUDED.titre,
    objectifs = EXCLUDED.objectifs,
    competences = EXCLUDED.competences,
    civic_theme = EXCLUDED.civic_theme,
    civic_mention = EXCLUDED.civic_mention,
    source_ids = EXCLUDED.source_ids,
    statut = CASE WHEN public.training_sessions.statut IN ('published', 'publishable')
      THEN public.training_sessions.statut
      ELSE EXCLUDED.statut
    END,
    updated_at = now();

  INSERT INTO public.training_sessions (
    plan_version_id, code, ordre, kind, module, palier, type_seance, duree_minutes,
    titre, objectifs, competences, civic_theme, civic_mention, source_ids, statut
  ) VALUES (
    v_plan_id,
    'S13',
    13,
    'session',
    'C',
    'A2',
    'dominante civique',
    180,
    'Liberté d''expression et limites',
    '["Donner un avis et reformuler un désaccord respectueux","Distinguer opinion, critique, insulte, diffamation et menace"]'::jsonb,
    ARRAY['CE', 'EO'],
    'Droits et devoirs',
    'CSP',
    ARRAY[]::text[],
    'planned'
  )
  ON CONFLICT (plan_version_id, code) DO UPDATE SET
    ordre = EXCLUDED.ordre,
    kind = EXCLUDED.kind,
    module = EXCLUDED.module,
    palier = EXCLUDED.palier,
    type_seance = EXCLUDED.type_seance,
    duree_minutes = EXCLUDED.duree_minutes,
    titre = EXCLUDED.titre,
    objectifs = EXCLUDED.objectifs,
    competences = EXCLUDED.competences,
    civic_theme = EXCLUDED.civic_theme,
    civic_mention = EXCLUDED.civic_mention,
    source_ids = EXCLUDED.source_ids,
    statut = CASE WHEN public.training_sessions.statut IN ('published', 'publishable')
      THEN public.training_sessions.statut
      ELSE EXCLUDED.statut
    END,
    updated_at = now();

  INSERT INTO public.training_sessions (
    plan_version_id, code, ordre, kind, module, palier, type_seance, duree_minutes,
    titre, objectifs, competences, civic_theme, civic_mention, source_ids, statut
  ) VALUES (
    v_plan_id,
    'S14',
    14,
    'session',
    'C',
    'A2',
    'mixte',
    180,
    'Impôts, services publics et environnement',
    '["Résumer une consigne locale et écrire à la mairie","Comprendre le financement public, l''environnement et la solidarité"]'::jsonb,
    ARRAY['CE', 'EE'],
    'Vivre dans la société française',
    'CSP',
    ARRAY[]::text[],
    'planned'
  )
  ON CONFLICT (plan_version_id, code) DO UPDATE SET
    ordre = EXCLUDED.ordre,
    kind = EXCLUDED.kind,
    module = EXCLUDED.module,
    palier = EXCLUDED.palier,
    type_seance = EXCLUDED.type_seance,
    duree_minutes = EXCLUDED.duree_minutes,
    titre = EXCLUDED.titre,
    objectifs = EXCLUDED.objectifs,
    competences = EXCLUDED.competences,
    civic_theme = EXCLUDED.civic_theme,
    civic_mention = EXCLUDED.civic_mention,
    source_ids = EXCLUDED.source_ids,
    statut = CASE WHEN public.training_sessions.statut IN ('published', 'publishable')
      THEN public.training_sessions.statut
      ELSE EXCLUDED.statut
    END,
    updated_at = now();

  INSERT INTO public.training_sessions (
    plan_version_id, code, ordre, kind, module, palier, type_seance, duree_minutes,
    titre, objectifs, competences, civic_theme, civic_mention, source_ids, statut
  ) VALUES (
    v_plan_id,
    'S15',
    15,
    'session',
    'C',
    'A2',
    'dominante civique',
    180,
    '1789, droits et République',
    '["Raconter 1789 et la Déclaration des droits de l''homme et du citoyen","Expliquer la conséquence d''un événement historique fondateur"]'::jsonb,
    ARRAY['CO', 'CE'],
    'Histoire, géographie, culture',
    'CSP',
    ARRAY[]::text[],
    'planned'
  )
  ON CONFLICT (plan_version_id, code) DO UPDATE SET
    ordre = EXCLUDED.ordre,
    kind = EXCLUDED.kind,
    module = EXCLUDED.module,
    palier = EXCLUDED.palier,
    type_seance = EXCLUDED.type_seance,
    duree_minutes = EXCLUDED.duree_minutes,
    titre = EXCLUDED.titre,
    objectifs = EXCLUDED.objectifs,
    competences = EXCLUDED.competences,
    civic_theme = EXCLUDED.civic_theme,
    civic_mention = EXCLUDED.civic_mention,
    source_ids = EXCLUDED.source_ids,
    statut = CASE WHEN public.training_sessions.statut IN ('published', 'publishable')
      THEN public.training_sessions.statut
      ELSE EXCLUDED.statut
    END,
    updated_at = now();

  INSERT INTO public.training_sessions (
    plan_version_id, code, ordre, kind, module, palier, type_seance, duree_minutes,
    titre, objectifs, competences, civic_theme, civic_mention, source_ids, statut
  ) VALUES (
    v_plan_id,
    'S16',
    16,
    'session',
    'C',
    'A2',
    'dominante civique',
    180,
    'France, territoires, Europe et patrimoine',
    '["Situer un lieu entre métropole, outre-mer et Europe","Présenter un élément de patrimoine et l''organisation territoriale"]'::jsonb,
    ARRAY['CO', 'EO'],
    'Histoire, géographie, culture',
    'CSP',
    ARRAY[]::text[],
    'planned'
  )
  ON CONFLICT (plan_version_id, code) DO UPDATE SET
    ordre = EXCLUDED.ordre,
    kind = EXCLUDED.kind,
    module = EXCLUDED.module,
    palier = EXCLUDED.palier,
    type_seance = EXCLUDED.type_seance,
    duree_minutes = EXCLUDED.duree_minutes,
    titre = EXCLUDED.titre,
    objectifs = EXCLUDED.objectifs,
    competences = EXCLUDED.competences,
    civic_theme = EXCLUDED.civic_theme,
    civic_mention = EXCLUDED.civic_mention,
    source_ids = EXCLUDED.source_ids,
    statut = CASE WHEN public.training_sessions.statut IN ('published', 'publishable')
      THEN public.training_sessions.statut
      ELSE EXCLUDED.statut
    END,
    updated_at = now();

  INSERT INTO public.training_sessions (
    plan_version_id, code, ordre, kind, module, palier, type_seance, duree_minutes,
    titre, objectifs, competences, civic_theme, civic_mention, source_ids, statut
  ) VALUES (
    v_plan_id,
    'E1',
    17,
    'evaluation',
    NULL,
    'A2',
    'évaluation intermédiaire à 50h',
    120,
    'Évaluation intermédiaire à 50 h',
    '["Évaluer CO, CE, EE, EO chronométrées et le civique CSP abrégé à 50h","Produire un plan automatique de remédiation S17-S24"]'::jsonb,
    ARRAY['CO', 'CE', 'EE', 'EO', 'civique'],
    NULL,
    'CSP',
    ARRAY[]::text[],
    'planned'
  )
  ON CONFLICT (plan_version_id, code) DO UPDATE SET
    ordre = EXCLUDED.ordre,
    kind = EXCLUDED.kind,
    module = EXCLUDED.module,
    palier = EXCLUDED.palier,
    type_seance = EXCLUDED.type_seance,
    duree_minutes = EXCLUDED.duree_minutes,
    titre = EXCLUDED.titre,
    objectifs = EXCLUDED.objectifs,
    competences = EXCLUDED.competences,
    civic_theme = EXCLUDED.civic_theme,
    civic_mention = EXCLUDED.civic_mention,
    source_ids = EXCLUDED.source_ids,
    statut = CASE WHEN public.training_sessions.statut IN ('published', 'publishable')
      THEN public.training_sessions.statut
      ELSE EXCLUDED.statut
    END,
    updated_at = now();

  INSERT INTO public.training_sessions (
    plan_version_id, code, ordre, kind, module, palier, type_seance, duree_minutes,
    titre, objectifs, competences, civic_theme, civic_mention, source_ids, statut
  ) VALUES (
    v_plan_id,
    'S17',
    18,
    'session',
    'D',
    'A2',
    'adaptative',
    180,
    'Remédiation fondée sur E1',
    '["Réviser une situation civique commune selon les erreurs dominantes de la cohorte","Mesurer le gain avant/après remédiation sans mélanger langue et civique"]'::jsonb,
    ARRAY['structures'],
    NULL,
    'CSP',
    ARRAY[]::text[],
    'planned'
  )
  ON CONFLICT (plan_version_id, code) DO UPDATE SET
    ordre = EXCLUDED.ordre,
    kind = EXCLUDED.kind,
    module = EXCLUDED.module,
    palier = EXCLUDED.palier,
    type_seance = EXCLUDED.type_seance,
    duree_minutes = EXCLUDED.duree_minutes,
    titre = EXCLUDED.titre,
    objectifs = EXCLUDED.objectifs,
    competences = EXCLUDED.competences,
    civic_theme = EXCLUDED.civic_theme,
    civic_mention = EXCLUDED.civic_mention,
    source_ids = EXCLUDED.source_ids,
    statut = CASE WHEN public.training_sessions.statut IN ('published', 'publishable')
      THEN public.training_sessions.statut
      ELSE EXCLUDED.statut
    END,
    updated_at = now();

  INSERT INTO public.training_sessions (
    plan_version_id, code, ordre, kind, module, palier, type_seance, duree_minutes,
    titre, objectifs, competences, civic_theme, civic_mention, source_ids, statut
  ) VALUES (
    v_plan_id,
    'S18',
    19,
    'session',
    'D',
    'A2',
    'mixte',
    180,
    'Répondre à une administration',
    '["Répondre à une administration avec trois tâches graduées proches de l''EE TCF","Comprendre droits de l''usager et obligations documentaires"]'::jsonb,
    ARRAY['EE'],
    'Droits et devoirs',
    'CSP',
    ARRAY[]::text[],
    'planned'
  )
  ON CONFLICT (plan_version_id, code) DO UPDATE SET
    ordre = EXCLUDED.ordre,
    kind = EXCLUDED.kind,
    module = EXCLUDED.module,
    palier = EXCLUDED.palier,
    type_seance = EXCLUDED.type_seance,
    duree_minutes = EXCLUDED.duree_minutes,
    titre = EXCLUDED.titre,
    objectifs = EXCLUDED.objectifs,
    competences = EXCLUDED.competences,
    civic_theme = EXCLUDED.civic_theme,
    civic_mention = EXCLUDED.civic_mention,
    source_ids = EXCLUDED.source_ids,
    statut = CASE WHEN public.training_sessions.statut IN ('published', 'publishable')
      THEN public.training_sessions.statut
      ELSE EXCLUDED.statut
    END,
    updated_at = now();

  INSERT INTO public.training_sessions (
    plan_version_id, code, ordre, kind, module, palier, type_seance, duree_minutes,
    titre, objectifs, competences, civic_theme, civic_mention, source_ids, statut
  ) VALUES (
    v_plan_id,
    'S19',
    20,
    'session',
    'D',
    'A2',
    'mixte',
    180,
    'Interagir avec un agent et résoudre un malentendu',
    '["Résoudre un malentendu au guichet avec trois tâches orales TCF","Connaître la neutralité des agents, le respect de la loi et les recours"]'::jsonb,
    ARRAY['EO'],
    'Droits et devoirs',
    'CSP',
    ARRAY[]::text[],
    'planned'
  )
  ON CONFLICT (plan_version_id, code) DO UPDATE SET
    ordre = EXCLUDED.ordre,
    kind = EXCLUDED.kind,
    module = EXCLUDED.module,
    palier = EXCLUDED.palier,
    type_seance = EXCLUDED.type_seance,
    duree_minutes = EXCLUDED.duree_minutes,
    titre = EXCLUDED.titre,
    objectifs = EXCLUDED.objectifs,
    competences = EXCLUDED.competences,
    civic_theme = EXCLUDED.civic_theme,
    civic_mention = EXCLUDED.civic_mention,
    source_ids = EXCLUDED.source_ids,
    statut = CASE WHEN public.training_sessions.statut IN ('published', 'publishable')
      THEN public.training_sessions.statut
      ELSE EXCLUDED.statut
    END,
    updated_at = now();

  INSERT INTO public.training_sessions (
    plan_version_id, code, ordre, kind, module, palier, type_seance, duree_minutes,
    titre, objectifs, competences, civic_theme, civic_mention, source_ids, statut
  ) VALUES (
    v_plan_id,
    'S20',
    21,
    'session',
    'D',
    'A2',
    'dominante civique',
    180,
    'Mémoire nationale et patrimoine',
    '["Présenter un repère de mémoire nationale avec sobriété et contexte","Connaître République, guerres, Résistance et Shoah"]'::jsonb,
    ARRAY['CO', 'CE'],
    'Histoire, géographie, culture',
    'CSP',
    ARRAY[]::text[],
    'planned'
  )
  ON CONFLICT (plan_version_id, code) DO UPDATE SET
    ordre = EXCLUDED.ordre,
    kind = EXCLUDED.kind,
    module = EXCLUDED.module,
    palier = EXCLUDED.palier,
    type_seance = EXCLUDED.type_seance,
    duree_minutes = EXCLUDED.duree_minutes,
    titre = EXCLUDED.titre,
    objectifs = EXCLUDED.objectifs,
    competences = EXCLUDED.competences,
    civic_theme = EXCLUDED.civic_theme,
    civic_mention = EXCLUDED.civic_mention,
    source_ids = EXCLUDED.source_ids,
    statut = CASE WHEN public.training_sessions.statut IN ('published', 'publishable')
      THEN public.training_sessions.statut
      ELSE EXCLUDED.statut
    END,
    updated_at = now();

  INSERT INTO public.training_sessions (
    plan_version_id, code, ordre, kind, module, palier, type_seance, duree_minutes,
    titre, objectifs, competences, civic_theme, civic_mention, source_ids, statut
  ) VALUES (
    v_plan_id,
    'S21',
    22,
    'session',
    'E',
    'A2',
    'dominante civique',
    180,
    'Mises en situation civiques simulées',
    '["Distinguer mise en situation civique et connaissance dans des items séparant les deux preuves","Expliquer pourquoi une conduite est conforme ou non"]'::jsonb,
    ARRAY['CO', 'CE'],
    NULL,
    'CSP',
    ARRAY[]::text[],
    'planned'
  )
  ON CONFLICT (plan_version_id, code) DO UPDATE SET
    ordre = EXCLUDED.ordre,
    kind = EXCLUDED.kind,
    module = EXCLUDED.module,
    palier = EXCLUDED.palier,
    type_seance = EXCLUDED.type_seance,
    duree_minutes = EXCLUDED.duree_minutes,
    titre = EXCLUDED.titre,
    objectifs = EXCLUDED.objectifs,
    competences = EXCLUDED.competences,
    civic_theme = EXCLUDED.civic_theme,
    civic_mention = EXCLUDED.civic_mention,
    source_ids = EXCLUDED.source_ids,
    statut = CASE WHEN public.training_sessions.statut IN ('published', 'publishable')
      THEN public.training_sessions.statut
      ELSE EXCLUDED.statut
    END,
    updated_at = now();

  INSERT INTO public.training_sessions (
    plan_version_id, code, ordre, kind, module, palier, type_seance, duree_minutes,
    titre, objectifs, competences, civic_theme, civic_mention, source_ids, statut
  ) VALUES (
    v_plan_id,
    'S22',
    23,
    'session',
    'E',
    'A2',
    'langue',
    180,
    'Expression écrite TCF, trois tâches',
    '["Réaliser les trois tâches d''expression écrite TCF dans des contextes civiques variés"]'::jsonb,
    ARRAY['EE'],
    NULL,
    'CSP',
    ARRAY[]::text[],
    'planned'
  )
  ON CONFLICT (plan_version_id, code) DO UPDATE SET
    ordre = EXCLUDED.ordre,
    kind = EXCLUDED.kind,
    module = EXCLUDED.module,
    palier = EXCLUDED.palier,
    type_seance = EXCLUDED.type_seance,
    duree_minutes = EXCLUDED.duree_minutes,
    titre = EXCLUDED.titre,
    objectifs = EXCLUDED.objectifs,
    competences = EXCLUDED.competences,
    civic_theme = EXCLUDED.civic_theme,
    civic_mention = EXCLUDED.civic_mention,
    source_ids = EXCLUDED.source_ids,
    statut = CASE WHEN public.training_sessions.statut IN ('published', 'publishable')
      THEN public.training_sessions.statut
      ELSE EXCLUDED.statut
    END,
    updated_at = now();

  INSERT INTO public.training_sessions (
    plan_version_id, code, ordre, kind, module, palier, type_seance, duree_minutes,
    titre, objectifs, competences, civic_theme, civic_mention, source_ids, statut
  ) VALUES (
    v_plan_id,
    'S23',
    24,
    'session',
    'E',
    'A2',
    'langue',
    180,
    'Expression orale TCF, trois tâches',
    '["Réaliser les trois tâches d''expression orale TCF (entretien dirigé, interaction, point de vue)"]'::jsonb,
    ARRAY['EO'],
    NULL,
    'CSP',
    ARRAY[]::text[],
    'planned'
  )
  ON CONFLICT (plan_version_id, code) DO UPDATE SET
    ordre = EXCLUDED.ordre,
    kind = EXCLUDED.kind,
    module = EXCLUDED.module,
    palier = EXCLUDED.palier,
    type_seance = EXCLUDED.type_seance,
    duree_minutes = EXCLUDED.duree_minutes,
    titre = EXCLUDED.titre,
    objectifs = EXCLUDED.objectifs,
    competences = EXCLUDED.competences,
    civic_theme = EXCLUDED.civic_theme,
    civic_mention = EXCLUDED.civic_mention,
    source_ids = EXCLUDED.source_ids,
    statut = CASE WHEN public.training_sessions.statut IN ('published', 'publishable')
      THEN public.training_sessions.statut
      ELSE EXCLUDED.statut
    END,
    updated_at = now();

  INSERT INTO public.training_sessions (
    plan_version_id, code, ordre, kind, module, palier, type_seance, duree_minutes,
    titre, objectifs, competences, civic_theme, civic_mention, source_ids, statut
  ) VALUES (
    v_plan_id,
    'S24',
    25,
    'session',
    'E',
    'A2',
    'simulation partielle, mixte',
    180,
    'Gestion du temps et répétition générale',
    '["Enchaîner les tâches TCF sans aide en conditions chronométrées","Réviser les cinq thèmes civiques et la stratégie 32/40"]'::jsonb,
    ARRAY['CO', 'CE', 'EE', 'EO'],
    NULL,
    'CSP',
    ARRAY[]::text[],
    'planned'
  )
  ON CONFLICT (plan_version_id, code) DO UPDATE SET
    ordre = EXCLUDED.ordre,
    kind = EXCLUDED.kind,
    module = EXCLUDED.module,
    palier = EXCLUDED.palier,
    type_seance = EXCLUDED.type_seance,
    duree_minutes = EXCLUDED.duree_minutes,
    titre = EXCLUDED.titre,
    objectifs = EXCLUDED.objectifs,
    competences = EXCLUDED.competences,
    civic_theme = EXCLUDED.civic_theme,
    civic_mention = EXCLUDED.civic_mention,
    source_ids = EXCLUDED.source_ids,
    statut = CASE WHEN public.training_sessions.statut IN ('published', 'publishable')
      THEN public.training_sessions.statut
      ELSE EXCLUDED.statut
    END,
    updated_at = now();

  INSERT INTO public.training_sessions (
    plan_version_id, code, ordre, kind, module, palier, type_seance, duree_minutes,
    titre, objectifs, competences, civic_theme, civic_mention, source_ids, statut
  ) VALUES (
    v_plan_id,
    'E2',
    26,
    'evaluation',
    NULL,
    'A2',
    'évaluation finale du tronc commun',
    180,
    'Évaluation finale du tronc commun',
    '["Passer le TCF IRN interne complet et le civique CSP complet (40 questions, 45 min)","Orienter vers sortie A2/CSP, extension B1/CR ou consolidation"]'::jsonb,
    ARRAY['CO', 'CE', 'EE', 'EO', 'civique'],
    NULL,
    'CSP',
    ARRAY[]::text[],
    'planned'
  )
  ON CONFLICT (plan_version_id, code) DO UPDATE SET
    ordre = EXCLUDED.ordre,
    kind = EXCLUDED.kind,
    module = EXCLUDED.module,
    palier = EXCLUDED.palier,
    type_seance = EXCLUDED.type_seance,
    duree_minutes = EXCLUDED.duree_minutes,
    titre = EXCLUDED.titre,
    objectifs = EXCLUDED.objectifs,
    competences = EXCLUDED.competences,
    civic_theme = EXCLUDED.civic_theme,
    civic_mention = EXCLUDED.civic_mention,
    source_ids = EXCLUDED.source_ids,
    statut = CASE WHEN public.training_sessions.statut IN ('published', 'publishable')
      THEN public.training_sessions.statut
      ELSE EXCLUDED.statut
    END,
    updated_at = now();

  INSERT INTO public.training_sessions (
    plan_version_id, code, ordre, kind, module, palier, type_seance, duree_minutes,
    titre, objectifs, competences, civic_theme, civic_mention, source_ids, statut
  ) VALUES (
    v_plan_id,
    'S25',
    27,
    'session',
    'E',
    'A2',
    'remédiation + orientation, mixte',
    180,
    'Consolidation, restitution et orientation',
    '["Refaire deux tâches équivalentes aux fragilités majeures identifiées par E2","Construire un contrat personnel et une restitution séparée langue/civique"]'::jsonb,
    ARRAY['CE', 'EO'],
    NULL,
    'CSP',
    ARRAY[]::text[],
    'planned'
  )
  ON CONFLICT (plan_version_id, code) DO UPDATE SET
    ordre = EXCLUDED.ordre,
    kind = EXCLUDED.kind,
    module = EXCLUDED.module,
    palier = EXCLUDED.palier,
    type_seance = EXCLUDED.type_seance,
    duree_minutes = EXCLUDED.duree_minutes,
    titre = EXCLUDED.titre,
    objectifs = EXCLUDED.objectifs,
    competences = EXCLUDED.competences,
    civic_theme = EXCLUDED.civic_theme,
    civic_mention = EXCLUDED.civic_mention,
    source_ids = EXCLUDED.source_ids,
    statut = CASE WHEN public.training_sessions.statut IN ('published', 'publishable')
      THEN public.training_sessions.statut
      ELSE EXCLUDED.statut
    END,
    updated_at = now();

  INSERT INTO public.training_sessions (
    plan_version_id, code, ordre, kind, module, palier, type_seance, duree_minutes,
    titre, objectifs, competences, civic_theme, civic_mention, source_ids, statut
  ) VALUES (
    v_plan_id,
    'S26',
    28,
    'session',
    'F',
    'B1',
    'dominante civique B1',
    180,
    'État de droit et séparation des pouvoirs',
    '["Expliquer une décision publique et ses contrôles institutionnels","Connaître l''État de droit, la séparation des pouvoirs et les élections"]'::jsonb,
    ARRAY['CE', 'EO'],
    'Système institutionnel et politique',
    'CR',
    ARRAY[]::text[],
    'planned'
  )
  ON CONFLICT (plan_version_id, code) DO UPDATE SET
    ordre = EXCLUDED.ordre,
    kind = EXCLUDED.kind,
    module = EXCLUDED.module,
    palier = EXCLUDED.palier,
    type_seance = EXCLUDED.type_seance,
    duree_minutes = EXCLUDED.duree_minutes,
    titre = EXCLUDED.titre,
    objectifs = EXCLUDED.objectifs,
    competences = EXCLUDED.competences,
    civic_theme = EXCLUDED.civic_theme,
    civic_mention = EXCLUDED.civic_mention,
    source_ids = EXCLUDED.source_ids,
    statut = CASE WHEN public.training_sessions.statut IN ('published', 'publishable')
      THEN public.training_sessions.statut
      ELSE EXCLUDED.statut
    END,
    updated_at = now();

  INSERT INTO public.training_sessions (
    plan_version_id, code, ordre, kind, module, palier, type_seance, duree_minutes,
    titre, objectifs, competences, civic_theme, civic_mention, source_ids, statut
  ) VALUES (
    v_plan_id,
    'S27',
    29,
    'session',
    'F',
    'B1',
    'dominante civique B1',
    180,
    'Argumenter sur droits et libertés',
    '["Défendre une opinion justifiée sur laïcité, expression ou manifestation","Connaître les droits, leurs limites et les discriminations"]'::jsonb,
    ARRAY['EO', 'EE'],
    'Droits et devoirs',
    'CR',
    ARRAY[]::text[],
    'planned'
  )
  ON CONFLICT (plan_version_id, code) DO UPDATE SET
    ordre = EXCLUDED.ordre,
    kind = EXCLUDED.kind,
    module = EXCLUDED.module,
    palier = EXCLUDED.palier,
    type_seance = EXCLUDED.type_seance,
    duree_minutes = EXCLUDED.duree_minutes,
    titre = EXCLUDED.titre,
    objectifs = EXCLUDED.objectifs,
    competences = EXCLUDED.competences,
    civic_theme = EXCLUDED.civic_theme,
    civic_mention = EXCLUDED.civic_mention,
    source_ids = EXCLUDED.source_ids,
    statut = CASE WHEN public.training_sessions.statut IN ('published', 'publishable')
      THEN public.training_sessions.statut
      ELSE EXCLUDED.statut
    END,
    updated_at = now();

  INSERT INTO public.training_sessions (
    plan_version_id, code, ordre, kind, module, palier, type_seance, duree_minutes,
    titre, objectifs, competences, civic_theme, civic_mention, source_ids, statut
  ) VALUES (
    v_plan_id,
    'S28',
    30,
    'session',
    'F',
    'B1',
    'mixte B1',
    180,
    'Travail, syndicats, impôts et solidarité',
    '["Rédiger une réclamation formelle et interpréter un document social","Connaître travail, syndicats, impôts et environnement"]'::jsonb,
    ARRAY['CE', 'EE'],
    'Vivre dans la société française',
    'CR',
    ARRAY[]::text[],
    'planned'
  )
  ON CONFLICT (plan_version_id, code) DO UPDATE SET
    ordre = EXCLUDED.ordre,
    kind = EXCLUDED.kind,
    module = EXCLUDED.module,
    palier = EXCLUDED.palier,
    type_seance = EXCLUDED.type_seance,
    duree_minutes = EXCLUDED.duree_minutes,
    titre = EXCLUDED.titre,
    objectifs = EXCLUDED.objectifs,
    competences = EXCLUDED.competences,
    civic_theme = EXCLUDED.civic_theme,
    civic_mention = EXCLUDED.civic_mention,
    source_ids = EXCLUDED.source_ids,
    statut = CASE WHEN public.training_sessions.statut IN ('published', 'publishable')
      THEN public.training_sessions.statut
      ELSE EXCLUDED.statut
    END,
    updated_at = now();

  INSERT INTO public.training_sessions (
    plan_version_id, code, ordre, kind, module, palier, type_seance, duree_minutes,
    titre, objectifs, competences, civic_theme, civic_mention, source_ids, statut
  ) VALUES (
    v_plan_id,
    'S29',
    31,
    'session',
    'F',
    'B1',
    'dominante civique B1',
    180,
    'Histoire républicaine, Europe et mémoire',
    '["Raconter un événement et expliquer sa portée historique et européenne","Relier histoire républicaine, construction européenne et mémoire"]'::jsonb,
    ARRAY['CO', 'EO'],
    'Histoire, géographie, culture',
    'CR',
    ARRAY[]::text[],
    'planned'
  )
  ON CONFLICT (plan_version_id, code) DO UPDATE SET
    ordre = EXCLUDED.ordre,
    kind = EXCLUDED.kind,
    module = EXCLUDED.module,
    palier = EXCLUDED.palier,
    type_seance = EXCLUDED.type_seance,
    duree_minutes = EXCLUDED.duree_minutes,
    titre = EXCLUDED.titre,
    objectifs = EXCLUDED.objectifs,
    competences = EXCLUDED.competences,
    civic_theme = EXCLUDED.civic_theme,
    civic_mention = EXCLUDED.civic_mention,
    source_ids = EXCLUDED.source_ids,
    statut = CASE WHEN public.training_sessions.statut IN ('published', 'publishable')
      THEN public.training_sessions.statut
      ELSE EXCLUDED.statut
    END,
    updated_at = now();

  INSERT INTO public.training_sessions (
    plan_version_id, code, ordre, kind, module, palier, type_seance, duree_minutes,
    titre, objectifs, competences, civic_theme, civic_mention, source_ids, statut
  ) VALUES (
    v_plan_id,
    'S30',
    32,
    'session',
    'F',
    'B1',
    'dominante civique B1',
    180,
    'Implicite et conduite conforme',
    '["Expliciter un indice implicite et justifier une conduite conforme","Prioriser principes et droits dans des situations CR"]'::jsonb,
    ARRAY['CO', 'CE'],
    'Droits et devoirs',
    'CR',
    ARRAY[]::text[],
    'planned'
  )
  ON CONFLICT (plan_version_id, code) DO UPDATE SET
    ordre = EXCLUDED.ordre,
    kind = EXCLUDED.kind,
    module = EXCLUDED.module,
    palier = EXCLUDED.palier,
    type_seance = EXCLUDED.type_seance,
    duree_minutes = EXCLUDED.duree_minutes,
    titre = EXCLUDED.titre,
    objectifs = EXCLUDED.objectifs,
    competences = EXCLUDED.competences,
    civic_theme = EXCLUDED.civic_theme,
    civic_mention = EXCLUDED.civic_mention,
    source_ids = EXCLUDED.source_ids,
    statut = CASE WHEN public.training_sessions.statut IN ('published', 'publishable')
      THEN public.training_sessions.statut
      ELSE EXCLUDED.statut
    END,
    updated_at = now();

  INSERT INTO public.training_sessions (
    plan_version_id, code, ordre, kind, module, palier, type_seance, duree_minutes,
    titre, objectifs, competences, civic_theme, civic_mention, source_ids, statut
  ) VALUES (
    v_plan_id,
    'S31',
    33,
    'session',
    'F',
    'B1',
    'simulation intégrée B1',
    180,
    'Simulation CR et remédiation',
    '["Réaliser une simulation CR 40/45 sans aide puis analyser les distracteurs","Cibler une remédiation B1 selon les fragilités de la cohorte"]'::jsonb,
    ARRAY['CE', 'civique'],
    NULL,
    'CR',
    ARRAY[]::text[],
    'planned'
  )
  ON CONFLICT (plan_version_id, code) DO UPDATE SET
    ordre = EXCLUDED.ordre,
    kind = EXCLUDED.kind,
    module = EXCLUDED.module,
    palier = EXCLUDED.palier,
    type_seance = EXCLUDED.type_seance,
    duree_minutes = EXCLUDED.duree_minutes,
    titre = EXCLUDED.titre,
    objectifs = EXCLUDED.objectifs,
    competences = EXCLUDED.competences,
    civic_theme = EXCLUDED.civic_theme,
    civic_mention = EXCLUDED.civic_mention,
    source_ids = EXCLUDED.source_ids,
    statut = CASE WHEN public.training_sessions.statut IN ('published', 'publishable')
      THEN public.training_sessions.statut
      ELSE EXCLUDED.statut
    END,
    updated_at = now();

  INSERT INTO public.training_sessions (
    plan_version_id, code, ordre, kind, module, palier, type_seance, duree_minutes,
    titre, objectifs, competences, civic_theme, civic_mention, source_ids, statut
  ) VALUES (
    v_plan_id,
    'E3',
    34,
    'evaluation',
    NULL,
    'B1',
    'évaluation de sortie B1/CR',
    120,
    'Évaluation de sortie B1 / CR',
    '["Évaluer CO, CE, EE, EO et le civique CR ciblé (25 min)","Décider sortie B1/CR, poursuite B2/NAT ou volume complémentaire"]'::jsonb,
    ARRAY['CO', 'CE', 'EE', 'EO', 'civique'],
    NULL,
    'CR',
    ARRAY[]::text[],
    'planned'
  )
  ON CONFLICT (plan_version_id, code) DO UPDATE SET
    ordre = EXCLUDED.ordre,
    kind = EXCLUDED.kind,
    module = EXCLUDED.module,
    palier = EXCLUDED.palier,
    type_seance = EXCLUDED.type_seance,
    duree_minutes = EXCLUDED.duree_minutes,
    titre = EXCLUDED.titre,
    objectifs = EXCLUDED.objectifs,
    competences = EXCLUDED.competences,
    civic_theme = EXCLUDED.civic_theme,
    civic_mention = EXCLUDED.civic_mention,
    source_ids = EXCLUDED.source_ids,
    statut = CASE WHEN public.training_sessions.statut IN ('published', 'publishable')
      THEN public.training_sessions.statut
      ELSE EXCLUDED.statut
    END,
    updated_at = now();

  INSERT INTO public.training_sessions (
    plan_version_id, code, ordre, kind, module, palier, type_seance, duree_minutes,
    titre, objectifs, competences, civic_theme, civic_mention, source_ids, statut
  ) VALUES (
    v_plan_id,
    'S32',
    35,
    'session',
    'G',
    'B2',
    'dominante civique B2',
    180,
    'Système constitutionnel et souveraineté',
    '["Produire une synthèse nuancée sur Constitution, souveraineté et contrôles institutionnels","Répondre à des relances sur l''État de droit et les pouvoirs"]'::jsonb,
    ARRAY['CE', 'EO'],
    'Système institutionnel et politique',
    'NAT',
    ARRAY[]::text[],
    'planned'
  )
  ON CONFLICT (plan_version_id, code) DO UPDATE SET
    ordre = EXCLUDED.ordre,
    kind = EXCLUDED.kind,
    module = EXCLUDED.module,
    palier = EXCLUDED.palier,
    type_seance = EXCLUDED.type_seance,
    duree_minutes = EXCLUDED.duree_minutes,
    titre = EXCLUDED.titre,
    objectifs = EXCLUDED.objectifs,
    competences = EXCLUDED.competences,
    civic_theme = EXCLUDED.civic_theme,
    civic_mention = EXCLUDED.civic_mention,
    source_ids = EXCLUDED.source_ids,
    statut = CASE WHEN public.training_sessions.statut IN ('published', 'publishable')
      THEN public.training_sessions.statut
      ELSE EXCLUDED.statut
    END,
    updated_at = now();

  INSERT INTO public.training_sessions (
    plan_version_id, code, ordre, kind, module, palier, type_seance, duree_minutes,
    titre, objectifs, competences, civic_theme, civic_mention, source_ids, statut
  ) VALUES (
    v_plan_id,
    'S33',
    36,
    'session',
    'G',
    'B2',
    'dominante civique B2',
    180,
    'Libertés, pluralisme et dignité',
    '["Défendre une position, intégrer une objection et conclure sur une liberté et ses limites","Connaître expression, laïcité, pluralisme et dignité"]'::jsonb,
    ARRAY['EE', 'EO'],
    'Droits et devoirs',
    'NAT',
    ARRAY[]::text[],
    'planned'
  )
  ON CONFLICT (plan_version_id, code) DO UPDATE SET
    ordre = EXCLUDED.ordre,
    kind = EXCLUDED.kind,
    module = EXCLUDED.module,
    palier = EXCLUDED.palier,
    type_seance = EXCLUDED.type_seance,
    duree_minutes = EXCLUDED.duree_minutes,
    titre = EXCLUDED.titre,
    objectifs = EXCLUDED.objectifs,
    competences = EXCLUDED.competences,
    civic_theme = EXCLUDED.civic_theme,
    civic_mention = EXCLUDED.civic_mention,
    source_ids = EXCLUDED.source_ids,
    statut = CASE WHEN public.training_sessions.statut IN ('published', 'publishable')
      THEN public.training_sessions.statut
      ELSE EXCLUDED.statut
    END,
    updated_at = now();

  INSERT INTO public.training_sessions (
    plan_version_id, code, ordre, kind, module, palier, type_seance, duree_minutes,
    titre, objectifs, competences, civic_theme, civic_mention, source_ids, statut
  ) VALUES (
    v_plan_id,
    'S34',
    37,
    'session',
    'G',
    'B2',
    'dominante civique B2',
    180,
    'Corpus historique multi-supports',
    '["Réaliser une synthèse multi-supports hiérarchisée (Lumières, Républiques, guerres, Europe)","Relier causes et conséquences historiques"]'::jsonb,
    ARRAY['CO', 'CE'],
    'Histoire, géographie, culture',
    'NAT',
    ARRAY[]::text[],
    'planned'
  )
  ON CONFLICT (plan_version_id, code) DO UPDATE SET
    ordre = EXCLUDED.ordre,
    kind = EXCLUDED.kind,
    module = EXCLUDED.module,
    palier = EXCLUDED.palier,
    type_seance = EXCLUDED.type_seance,
    duree_minutes = EXCLUDED.duree_minutes,
    titre = EXCLUDED.titre,
    objectifs = EXCLUDED.objectifs,
    competences = EXCLUDED.competences,
    civic_theme = EXCLUDED.civic_theme,
    civic_mention = EXCLUDED.civic_mention,
    source_ids = EXCLUDED.source_ids,
    statut = CASE WHEN public.training_sessions.statut IN ('published', 'publishable')
      THEN public.training_sessions.statut
      ELSE EXCLUDED.statut
    END,
    updated_at = now();

  INSERT INTO public.training_sessions (
    plan_version_id, code, ordre, kind, module, palier, type_seance, duree_minutes,
    titre, objectifs, competences, civic_theme, civic_mention, source_ids, statut
  ) VALUES (
    v_plan_id,
    'S35',
    38,
    'session',
    'G',
    'B2',
    'mixte B2',
    180,
    'Citoyenneté et enjeu contemporain',
    '["Prendre position de façon documentée et prudente sur un enjeu contemporain","Connaître citoyenneté, environnement, francophonie et cohésion"]'::jsonb,
    ARRAY['CE', 'EE'],
    'Vivre dans la société française',
    'NAT',
    ARRAY[]::text[],
    'planned'
  )
  ON CONFLICT (plan_version_id, code) DO UPDATE SET
    ordre = EXCLUDED.ordre,
    kind = EXCLUDED.kind,
    module = EXCLUDED.module,
    palier = EXCLUDED.palier,
    type_seance = EXCLUDED.type_seance,
    duree_minutes = EXCLUDED.duree_minutes,
    titre = EXCLUDED.titre,
    objectifs = EXCLUDED.objectifs,
    competences = EXCLUDED.competences,
    civic_theme = EXCLUDED.civic_theme,
    civic_mention = EXCLUDED.civic_mention,
    source_ids = EXCLUDED.source_ids,
    statut = CASE WHEN public.training_sessions.statut IN ('published', 'publishable')
      THEN public.training_sessions.statut
      ELSE EXCLUDED.statut
    END,
    updated_at = now();

  INSERT INTO public.training_sessions (
    plan_version_id, code, ordre, kind, module, palier, type_seance, duree_minutes,
    titre, objectifs, competences, civic_theme, civic_mention, source_ids, statut
  ) VALUES (
    v_plan_id,
    'S36',
    39,
    'session',
    'G',
    'B2',
    'simulation civique NAT',
    180,
    'Simulation NAT sous contrainte',
    '["Réaliser une simulation NAT sous contrainte (40/45, 28 connaissances, 12 situations)","Comparer le score et les erreurs à la simulation précédente"]'::jsonb,
    ARRAY['civique'],
    NULL,
    'NAT',
    ARRAY[]::text[],
    'planned'
  )
  ON CONFLICT (plan_version_id, code) DO UPDATE SET
    ordre = EXCLUDED.ordre,
    kind = EXCLUDED.kind,
    module = EXCLUDED.module,
    palier = EXCLUDED.palier,
    type_seance = EXCLUDED.type_seance,
    duree_minutes = EXCLUDED.duree_minutes,
    titre = EXCLUDED.titre,
    objectifs = EXCLUDED.objectifs,
    competences = EXCLUDED.competences,
    civic_theme = EXCLUDED.civic_theme,
    civic_mention = EXCLUDED.civic_mention,
    source_ids = EXCLUDED.source_ids,
    statut = CASE WHEN public.training_sessions.statut IN ('published', 'publishable')
      THEN public.training_sessions.statut
      ELSE EXCLUDED.statut
    END,
    updated_at = now();

  INSERT INTO public.training_sessions (
    plan_version_id, code, ordre, kind, module, palier, type_seance, duree_minutes,
    titre, objectifs, competences, civic_theme, civic_mention, source_ids, statut
  ) VALUES (
    v_plan_id,
    'S37',
    40,
    'session',
    'G',
    'B2',
    'EO B2 + entretien',
    180,
    'Parcours, principes et entretien d''assimilation',
    '["Présenter son parcours et répondre à des relances imprévues en entretien simulé","Mobiliser les principes républicains et la motivation"]'::jsonb,
    ARRAY['EO'],
    'Principes et valeurs de la République',
    'NAT',
    ARRAY[]::text[],
    'planned'
  )
  ON CONFLICT (plan_version_id, code) DO UPDATE SET
    ordre = EXCLUDED.ordre,
    kind = EXCLUDED.kind,
    module = EXCLUDED.module,
    palier = EXCLUDED.palier,
    type_seance = EXCLUDED.type_seance,
    duree_minutes = EXCLUDED.duree_minutes,
    titre = EXCLUDED.titre,
    objectifs = EXCLUDED.objectifs,
    competences = EXCLUDED.competences,
    civic_theme = EXCLUDED.civic_theme,
    civic_mention = EXCLUDED.civic_mention,
    source_ids = EXCLUDED.source_ids,
    statut = CASE WHEN public.training_sessions.statut IN ('published', 'publishable')
      THEN public.training_sessions.statut
      ELSE EXCLUDED.statut
    END,
    updated_at = now();

  INSERT INTO public.training_sessions (
    plan_version_id, code, ordre, kind, module, palier, type_seance, duree_minutes,
    titre, objectifs, competences, civic_theme, civic_mention, source_ids, statut
  ) VALUES (
    v_plan_id,
    'E4',
    41,
    'evaluation',
    NULL,
    'B2',
    'évaluation de sortie B2/NAT',
    120,
    'Évaluation de sortie B2 / NAT',
    '["Passer un échantillon TCF IRN ciblé, l''examen civique NAT complet et un entretien d''assimilation simulé","Décider : prêt à l''inscription, consolidation ciblée ou volume supplémentaire"]'::jsonb,
    ARRAY['EO', 'civique'],
    NULL,
    'NAT',
    ARRAY[]::text[],
    'planned'
  )
  ON CONFLICT (plan_version_id, code) DO UPDATE SET
    ordre = EXCLUDED.ordre,
    kind = EXCLUDED.kind,
    module = EXCLUDED.module,
    palier = EXCLUDED.palier,
    type_seance = EXCLUDED.type_seance,
    duree_minutes = EXCLUDED.duree_minutes,
    titre = EXCLUDED.titre,
    objectifs = EXCLUDED.objectifs,
    competences = EXCLUDED.competences,
    civic_theme = EXCLUDED.civic_theme,
    civic_mention = EXCLUDED.civic_mention,
    source_ids = EXCLUDED.source_ids,
    statut = CASE WHEN public.training_sessions.statut IN ('published', 'publishable')
      THEN public.training_sessions.statut
      ELSE EXCLUDED.statut
    END,
    updated_at = now();

END $$;

COMMIT;
