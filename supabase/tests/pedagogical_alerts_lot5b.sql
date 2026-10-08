-- Lot 5B — pedagogical_alerts (pgTAP pour `supabase db test --local`).
-- Jamais contre la base distante / --linked. ROLLBACK en fin de plan.
-- Prérequis : migration 20261007073216_pedagogical_alerts_lot5b appliquée en local.
-- Les messages ci-dessous sont ceux produits par cette migration sur Postgres 17
-- (RAISE EXCEPTION → P0001 ; CHECK/UNIQUE/privilège → SQLSTATE du serveur).

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

SELECT extensions.plan(29);

SELECT extensions.has_table('public', 'pedagogical_alerts', 'table pedagogical_alerts existe');

SELECT extensions.ok(
  NOT has_table_privilege('anon', 'public.pedagogical_alerts', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.pedagogical_alerts', 'INSERT')
  AND NOT has_table_privilege('anon', 'public.pedagogical_alerts', 'UPDATE')
  AND NOT has_table_privilege('anon', 'public.pedagogical_alerts', 'DELETE'),
  'anon sans accès pedagogical_alerts'
);

SELECT extensions.ok(
  has_function_privilege('authenticated', 'public.formateur_teaches_eleve(uuid, uuid)', 'EXECUTE'),
  'authenticated peut exécuter formateur_teaches_eleve'
);

SELECT extensions.ok(
  NOT has_function_privilege('anon', 'public.formateur_teaches_eleve(uuid, uuid)', 'EXECUTE'),
  'anon ne peut pas exécuter formateur_teaches_eleve'
);

SELECT extensions.ok(
  NOT has_function_privilege('public', 'public.formateur_teaches_eleve(uuid, uuid)', 'EXECUTE'),
  'PUBLIC ne conserve pas EXECUTE sur formateur_teaches_eleve'
);

SELECT extensions.lives_ok(
  $$
  INSERT INTO public.profiles (id, email, nom, prenom) VALUES
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'f1-lot5b@example.test', 'Form', 'Un'),
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'f2-lot5b@example.test', 'Form', 'Deux'),
    ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'e1-lot5b@example.test', 'Eleve', 'Un'),
    ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'e2-lot5b@example.test', 'Eleve', 'Deux')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.groups (id, formateur_id, nom) VALUES
    ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'Groupe Lot5B A'),
    ('cccccccc-cccc-4ccc-8ccc-ccccccccccc2', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'Groupe Lot5B B')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.group_members (group_id, eleve_id) VALUES
    ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'),
    ('cccccccc-cccc-4ccc-8ccc-ccccccccccc2', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2')
  ON CONFLICT (group_id, eleve_id) DO NOTHING;
  $$,
  'fixtures formateur/élève/groupe'
);

-- Le trigger BEFORE INSERT refuse tout statut autre que nouveau avant le CHECK du motif.
SELECT extensions.throws_ok(
  $$
  INSERT INTO public.pedagogical_alerts (
    formateur_id, eleve_id, sous_competence, rule_id, status,
    motif_classement, window_start, window_end, evidence
  ) VALUES (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    'reperer_info_explicite', 'repeated_failure_or_max_help_7d', 'classe',
    NULL, now() - interval '7 days', now(),
    '{"attempt_ids":[],"event_ids":[],"failures_count":3,"max_help_uses":0}'::jsonb
  );
  $$,
  'P0001',
  'pedagogical_alerts: insert uniquement en status=nouveau',
  'insert direct status=classe refusé par le trigger'
);

SELECT extensions.throws_ok(
  $$
  INSERT INTO public.pedagogical_alerts (
    formateur_id, eleve_id, sous_competence, rule_id, status,
    window_start, window_end
  ) VALUES (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    'fenetre_incoherente', 'repeated_failure_or_max_help_7d', 'nouveau',
    now(), now() - interval '1 day'
  );
  $$,
  '23514',
  'new row for relation "pedagogical_alerts" violates check constraint "pedagogical_alerts_window_coherent"',
  'window_end < window_start refusé par pedagogical_alerts_window_coherent'
);

SELECT extensions.lives_ok(
  $$
  INSERT INTO public.pedagogical_alerts (
    formateur_id, eleve_id, sous_competence, rule_id, status,
    window_start, window_end, evidence
  ) VALUES (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    'reperer_info_explicite', 'repeated_failure_or_max_help_7d', 'nouveau',
    now() - interval '7 days', now(),
    '{"attempt_ids":["40000000-0000-4000-8000-000000000001"],"event_ids":[],"failures_count":3,"max_help_uses":0}'::jsonb
  );
  $$,
  'création alerte ouverte'
);

SELECT extensions.throws_ok(
  $$
  INSERT INTO public.pedagogical_alerts (
    formateur_id, eleve_id, sous_competence, rule_id, status,
    window_start, window_end, evidence
  ) VALUES (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    'reperer_info_explicite', 'repeated_failure_or_max_help_7d', 'nouveau',
    now() - interval '6 days', now(),
    '{"attempt_ids":[],"event_ids":[],"failures_count":4,"max_help_uses":0}'::jsonb
  );
  $$,
  '23505',
  'duplicate key value violates unique constraint "pedagogical_alerts_one_open_idx"',
  'déduplication alertes ouvertes'
);

SELECT extensions.lives_ok(
  $$
  UPDATE public.pedagogical_alerts
  SET status = 'confirme'
  WHERE formateur_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
    AND eleve_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'
    AND status = 'nouveau'
    AND sous_competence = 'reperer_info_explicite';
  $$,
  'transition nouveau → confirme'
);

-- BEFORE UPDATE lève P0001 avant le CHECK pedagogical_alerts_motif_si_classe.
SELECT extensions.throws_ok(
  $$
  UPDATE public.pedagogical_alerts
  SET status = 'classe', motif_classement = NULL
  WHERE formateur_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
    AND status = 'confirme'
    AND sous_competence = 'reperer_info_explicite';
  $$,
  'P0001',
  'pedagogical_alerts: motif_classement requis pour classer',
  'confirme → classe sans motif refusé par le trigger'
);

SELECT extensions.lives_ok(
  $$
  UPDATE public.pedagogical_alerts
  SET status = 'classe', motif_classement = 'Remédiation planifiée'
  WHERE formateur_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
    AND status = 'confirme'
    AND sous_competence = 'reperer_info_explicite';
  $$,
  'transition confirme → classe avec motif'
);

SELECT extensions.lives_ok(
  $$
  INSERT INTO public.pedagogical_alerts (
    formateur_id, eleve_id, sous_competence, rule_id, status,
    window_start, window_end, evidence
  ) VALUES (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    'reperer_info_explicite', 'repeated_failure_or_max_help_7d', 'nouveau',
    now() - interval '7 days', now(),
    '{"attempt_ids":["40000000-0000-4000-8000-000000000002"],"event_ids":[],"failures_count":3,"max_help_uses":0}'::jsonb
  );
  $$,
  'nouvelle alerte après classement'
);

SELECT extensions.throws_ok(
  $$
  UPDATE public.pedagogical_alerts SET status = 'nouveau'
  WHERE status = 'classe' AND sous_competence = 'reperer_info_explicite'
    AND formateur_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
  $$,
  'P0001',
  'pedagogical_alerts: transition interdite classe → nouveau',
  'transition inverse classe → nouveau refusée'
);

SELECT extensions.throws_ok(
  $$
  UPDATE public.pedagogical_alerts
  SET status = 'classe', motif_classement = 'saut'
  WHERE status = 'nouveau' AND sous_competence = 'reperer_info_explicite'
    AND formateur_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
  $$,
  'P0001',
  'pedagogical_alerts: transition interdite nouveau → classe',
  'saut nouveau → classe refusé'
);

SELECT extensions.throws_ok(
  $$
  UPDATE public.pedagogical_alerts
  SET evidence = '{"attempt_ids":["forged"],"event_ids":[],"failures_count":99,"max_help_uses":99}'::jsonb
  WHERE status = 'nouveau' AND formateur_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
    AND sous_competence = 'reperer_info_explicite';
  $$,
  'P0001',
  'pedagogical_alerts: preuves, fenêtre et created_at immuables',
  'preuves immuables via client'
);

SELECT extensions.throws_ok(
  $$
  UPDATE public.pedagogical_alerts
  SET formateur_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'
  WHERE status = 'nouveau' AND formateur_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
    AND sous_competence = 'reperer_info_explicite';
  $$,
  'P0001',
  'pedagogical_alerts: identité, règle et sous-compétence immuables',
  'formateur_id immuable'
);

SELECT extensions.throws_ok(
  $$
  UPDATE public.pedagogical_alerts SET rule_id = 'autre_regle'
  WHERE status = 'nouveau' AND formateur_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
    AND sous_competence = 'reperer_info_explicite';
  $$,
  'P0001',
  'pedagogical_alerts: identité, règle et sous-compétence immuables',
  'rule_id immuable'
);

SELECT extensions.throws_ok(
  $$
  UPDATE public.pedagogical_alerts
  SET eleve_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'
  WHERE status = 'nouveau' AND formateur_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
    AND sous_competence = 'reperer_info_explicite';
  $$,
  'P0001',
  'pedagogical_alerts: identité, règle et sous-compétence immuables',
  'eleve_id immuable'
);

SELECT extensions.throws_ok(
  $$
  UPDATE public.pedagogical_alerts
  SET sous_competence = 'autre_sous_competence'
  WHERE status = 'nouveau' AND formateur_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
    AND sous_competence = 'reperer_info_explicite';
  $$,
  'P0001',
  'pedagogical_alerts: identité, règle et sous-compétence immuables',
  'sous_competence immuable'
);

SELECT extensions.throws_ok(
  $$
  UPDATE public.pedagogical_alerts
  SET window_start = window_start - interval '1 hour'
  WHERE status = 'nouveau' AND formateur_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
    AND sous_competence = 'reperer_info_explicite';
  $$,
  'P0001',
  'pedagogical_alerts: preuves, fenêtre et created_at immuables',
  'window_start immuable'
);

SELECT extensions.throws_ok(
  $$
  UPDATE public.pedagogical_alerts
  SET window_end = window_end + interval '1 hour'
  WHERE status = 'nouveau' AND formateur_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
    AND sous_competence = 'reperer_info_explicite';
  $$,
  'P0001',
  'pedagogical_alerts: preuves, fenêtre et created_at immuables',
  'window_end immuable'
);

SELECT extensions.throws_ok(
  $$
  UPDATE public.pedagogical_alerts
  SET created_at = created_at - interval '1 second'
  WHERE status = 'nouveau' AND formateur_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
    AND sous_competence = 'reperer_info_explicite';
  $$,
  'P0001',
  'pedagogical_alerts: preuves, fenêtre et created_at immuables',
  'created_at immuable'
);

-- RLS (jwt claim + rôle authenticated)
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;

SELECT extensions.isnt_empty(
  $$
  SELECT 1 FROM public.pedagogical_alerts
  WHERE eleve_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'
  $$,
  'formateur autorisé voit les alertes de son élève'
);

SELECT extensions.throws_ok(
  $$
  DELETE FROM public.pedagogical_alerts
  WHERE formateur_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
  $$,
  '42501',
  'permission denied for table pedagogical_alerts',
  'authenticated ne peut pas supprimer une alerte'
);

RESET ROLE;

SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', true);
SET LOCAL ROLE authenticated;

SELECT extensions.is_empty(
  $$
  SELECT 1 FROM public.pedagogical_alerts
  WHERE eleve_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'
  $$,
  'autre formateur ne voit pas les alertes hors groupe'
);

SELECT extensions.throws_ok(
  $$
  INSERT INTO public.pedagogical_alerts (
    formateur_id, eleve_id, sous_competence, rule_id, status,
    window_start, window_end, evidence
  ) VALUES (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    'reperer_info_explicite', 'repeated_failure_or_max_help_7d', 'nouveau',
    now() - interval '7 days', now(),
    '{"attempt_ids":[],"event_ids":[],"failures_count":3,"max_help_uses":0}'::jsonb
  );
  $$,
  '42501',
  'new row violates row-level security policy for table "pedagogical_alerts"',
  'autre formateur ne peut pas créer d’alerte pour un élève hors groupe'
);

RESET ROLE;

SELECT set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', true);
SET LOCAL ROLE authenticated;

SELECT extensions.is_empty(
  $$ SELECT 1 FROM public.pedagogical_alerts $$,
  'élève ne lit aucune alerte pédagogique'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

SELECT * FROM extensions.finish();
ROLLBACK;
