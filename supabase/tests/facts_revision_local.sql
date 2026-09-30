-- psql ONLY against a disposable local database with the project schema/migration.
-- Never use a linked/remote project. All fixture writes roll back.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
  IF inet_server_addr() IS NOT NULL AND inet_server_addr() NOT IN ('127.0.0.1'::inet,'::1'::inet) THEN
    RAISE EXCEPTION 'LOCAL_SOCKET_OR_LOOPBACK_REQUIRED';
  END IF;
END $$;

-- Synthetic actors/source/family, unrelated to the real Eclipse source.
INSERT INTO auth.users(id,email) VALUES
 ('10000000-0000-4000-8000-000000000001','facts-owner@local.invalid'),
 ('10000000-0000-4000-8000-000000000002','facts-other@local.invalid'),
 ('10000000-0000-4000-8000-000000000003','facts-student@local.invalid');
INSERT INTO public.profiles(id,email) VALUES
 ('10000000-0000-4000-8000-000000000001','facts-owner@local.invalid'),
 ('10000000-0000-4000-8000-000000000002','facts-other@local.invalid'),
 ('10000000-0000-4000-8000-000000000003','facts-student@local.invalid') ON CONFLICT(id) DO NOTHING;
DELETE FROM public.user_roles WHERE user_id IN ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003');
INSERT INTO public.user_roles(user_id,role) VALUES
 ('10000000-0000-4000-8000-000000000001','formateur'),
 ('10000000-0000-4000-8000-000000000002','formateur'),
 ('10000000-0000-4000-8000-000000000003','eleve');
INSERT INTO public.pedagogical_sources(id,title,storage_path,created_by,metadata) VALUES
 ('20000000-0000-4000-8000-000000000001','LOCAL facts test','local/fixture.mp3','10000000-0000-4000-8000-000000000001','{"studio_facts_confirmation":{"facts_hash":"old-confirmation"}}');
INSERT INTO public.differentiation_families(id,source_id,family_id,created_by,target_level,referential_version,source_content_hash,generation_status,generation_completed_at,payload) VALUES
 ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','LOCAL-FACTS-TEST','10000000-0000-4000-8000-000000000001','A2','co-a2-1.2','sha256:'||repeat('a',64),'generated',now(),
 '{"version":1,"facts":{"facts_hash":"sha256:0613abe1727a710cdccb212acff28301b26ece9ffead7605ef6c4cea359881f4","required":[{"fact_id":"fact_01","subject":"Charlotte","predicate":"explique","object":"fait 1","semantic_qualifiers":{"speaker":"Charlotte"},"required_for_task":true,"provenance":{"quote":"immutable proof"}},{"fact_id":"fact_02","subject":"Charlotte","predicate":"explique","object":"fait 2","semantic_qualifiers":{"speaker":"Charlotte"},"required_for_task":true,"provenance":{"quote":"second proof"}}]},"variants":{"A2":{"exercise":{"items":[{"id":"q1","fact_refs":["fact_01"]}]}}}}');

CREATE FUNCTION pg_temp.revise(edits jsonb, expected text DEFAULT 'sha256:0613abe1727a710cdccb212acff28301b26ece9ffead7605ef6c4cea359881f4', family uuid DEFAULT '30000000-0000-4000-8000-000000000001') RETURNS jsonb LANGUAGE sql SECURITY INVOKER AS $$
 SELECT public.revise_differentiation_facts_atomically('20000000-0000-4000-8000-000000000001',family,expected,1,
 (SELECT updated_at FROM public.pedagogical_sources WHERE id='20000000-0000-4000-8000-000000000001'),edits);
$$;
CREATE FUNCTION pg_temp.expect_refusal(edits jsonb, expected_code text, hash text DEFAULT 'sha256:0613abe1727a710cdccb212acff28301b26ece9ffead7605ef6c4cea359881f4', family uuid DEFAULT '30000000-0000-4000-8000-000000000001') RETURNS void LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE before_payload jsonb; after_payload jsonb;
BEGIN
 SELECT payload INTO before_payload FROM public.differentiation_families WHERE id='30000000-0000-4000-8000-000000000001';
 BEGIN
  PERFORM pg_temp.revise(edits,hash,family);
  RAISE EXCEPTION 'TEST_UNEXPECTED_SUCCESS';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>expected_code THEN RAISE EXCEPTION 'Expected %, got %',expected_code,SQLERRM; END IF;
 END;
 SELECT payload INTO after_payload FROM public.differentiation_families WHERE id='30000000-0000-4000-8000-000000000001';
 IF before_payload IS DISTINCT FROM after_payload THEN RAISE EXCEPTION 'PARTIAL_WRITE'; END IF;
END;
$$;
DO $$ BEGIN
 IF has_function_privilege('anon','public.revise_differentiation_facts_atomically(uuid,uuid,text,integer,timestamptz,jsonb)','EXECUTE')
 OR has_function_privilege('service_role','public.revise_differentiation_facts_atomically(uuid,uuid,text,integer,timestamptz,jsonb)','EXECUTE')
 OR has_function_privilege('authenticated','public.studio_facts_hash(jsonb)','EXECUTE') THEN RAISE EXCEPTION 'EXCESS_PRIVILEGE'; END IF;
 IF public.studio_facts_hash((SELECT payload #> '{facts,required}' FROM public.differentiation_families WHERE id='30000000-0000-4000-8000-000000000001'))<>'sha256:0613abe1727a710cdccb212acff28301b26ece9ffead7605ef6c4cea359881f4' THEN RAISE EXCEPTION 'JS_SQL_HASH_MISMATCH'; END IF;
END $$;

SET LOCAL ROLE anon;
DO $$ BEGIN
 IF current_user<>'anon' OR auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'WRONG_ANON_CONTEXT'; END IF;
 BEGIN
  PERFORM public.revise_differentiation_facts_atomically(NULL,NULL,NULL,NULL,NULL,'[]');
  RAISE EXCEPTION 'ANON_SUCCEEDED';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
DO $$ BEGIN IF current_user<>'authenticated' OR auth.uid()<>'10000000-0000-4000-8000-000000000003' THEN RAISE EXCEPTION 'WRONG_STUDENT_CONTEXT'; END IF; END $$;
SELECT pg_temp.expect_refusal('[]','FACTS_REVISION_FORBIDDEN');
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
DO $$ BEGIN IF current_user<>'authenticated' OR auth.uid()<>'10000000-0000-4000-8000-000000000002' THEN RAISE EXCEPTION 'WRONG_OTHER_CONTEXT'; END IF; END $$;
SELECT pg_temp.expect_refusal('[]','SOURCE_FORBIDDEN');
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
DO $$ BEGIN IF current_user<>'authenticated' OR auth.uid()<>'10000000-0000-4000-8000-000000000001' THEN RAISE EXCEPTION 'WRONG_OWNER_CONTEXT'; END IF; END $$;
SELECT pg_temp.expect_refusal('[]','FACTS_REVISION_CONFLICT','wrong');
SELECT pg_temp.expect_refusal('[]','FAMILY_SOURCE_MISMATCH',family=>'30000000-0000-4000-8000-000000000009');
SELECT pg_temp.expect_refusal('[]','FACTS_INVALID');
SELECT pg_temp.expect_refusal('[{"fact_id":"unknown"}]','FACT_ID_UNKNOWN');
SELECT pg_temp.expect_refusal('[{"fact_id":"fact_01","provenance":{"quote":"forged"}}]','FACT_FIELDS_FORBIDDEN');
SELECT pg_temp.expect_refusal('[{"fact_id":"fact_01","subject":"Charlotte","predicate":"explique","object":"a"},{"fact_id":"fact_01"}]','FACT_ID_INVALID');
SELECT pg_temp.expect_refusal('[{"fact_id":"fact_02","subject":"Charlotte","predicate":"explique","object":"a"}]','FACT_REFERENCED_BY_ITEM');
-- Failure after the first UPDATE must roll back both rows.
RESET ROLE;
CREATE FUNCTION pg_temp.force_source_error() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'TEST_FORCED_ROLLBACK'; END $$;
CREATE TRIGGER zz_facts_test_error BEFORE UPDATE ON public.pedagogical_sources FOR EACH ROW EXECUTE FUNCTION pg_temp.force_source_error();
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_refusal('[{"fact_id":"fact_01","subject":"Charlotte","predicate":"explique","object":"a"}]','TEST_FORCED_ROLLBACK');
RESET ROLE;
DROP TRIGGER zz_facts_test_error ON public.pedagogical_sources;
-- A validated (non-draft) family is also not editable.
INSERT INTO public.epreuves(competence,nom) VALUES ('CO','Local CO fixture') ON CONFLICT(competence) DO NOTHING;
INSERT INTO public.sous_sections(id,epreuve_id,nom) SELECT '40000000-0000-4000-8000-000000000001',id,'Local fixture' FROM public.epreuves WHERE competence='CO';
INSERT INTO public.points_a_maitriser(id,sous_section_id,nom) VALUES ('40000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001','Local fixture');
INSERT INTO public.exercices(id,formateur_id,point_a_maitriser_id,competence,titre,consigne) VALUES
 ('40000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002','CO','Local fixture','Local fixture');
UPDATE public.differentiation_families SET review_status='published',validation_status='passed',published_exercise_id='40000000-0000-4000-8000-000000000003' WHERE id='30000000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_refusal('[]','FAMILY_NOT_EDITABLE');
RESET ROLE;
UPDATE public.differentiation_families SET published_exercise_id=NULL,review_status='draft' WHERE id='30000000-0000-4000-8000-000000000001';
UPDATE public.differentiation_families SET review_status='validated' WHERE id='30000000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_refusal('[]','FAMILY_NOT_EDITABLE');
RESET ROLE;
UPDATE public.differentiation_families SET review_status='draft' WHERE id='30000000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
DO $$ DECLARE receipt jsonb; BEGIN
 receipt:=pg_temp.revise('[{"fact_id":"fact_01","subject":"Charlotte","predicate":"explique","object":"Corrigé : éclipse, \"totalité\"\n😊"}]');
 IF receipt->>'new_hash'<>'sha256:789e1ad302f7330cdec301db2f5ec3e7f1fa69f2fa4f15a5a3c9624d7d4acd04' OR receipt->>'fact_count'<>'1' OR receipt->>'status'<>'draft' THEN RAISE EXCEPTION 'RECEIPT_INVALID'; END IF;
 IF EXISTS(SELECT 1 FROM public.pedagogical_sources WHERE id='20000000-0000-4000-8000-000000000001' AND metadata ? 'studio_facts_confirmation') THEN RAISE EXCEPTION 'CONFIRMATION_NOT_INVALIDATED'; END IF;
 IF (SELECT payload #>> '{facts,required,0,provenance,quote}' FROM public.differentiation_families WHERE id='30000000-0000-4000-8000-000000000001')<>'immutable proof' THEN RAISE EXCEPTION 'PROVENANCE_CHANGED'; END IF;
END $$;
SELECT pg_temp.expect_refusal('[]','FACTS_REVISION_CONFLICT');
DO $$ BEGIN
 BEGIN
  UPDATE public.differentiation_families SET payload=jsonb_set(payload,'{facts,facts_hash}','"forged"') WHERE id='30000000-0000-4000-8000-000000000001';
  RAISE EXCEPTION 'DIRECT_HASH_WRITE_SUCCEEDED';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  UPDATE public.pedagogical_sources SET metadata=jsonb_build_object('studio_facts_confirmation',jsonb_build_object('facts_hash','old-confirmation','confirmed_by',auth.uid())) WHERE id='20000000-0000-4000-8000-000000000001';
  RAISE EXCEPTION 'STALE_CONFIRMATION_SUCCEEDED';
 EXCEPTION WHEN serialization_failure THEN NULL; END;
END $$;
RESET ROLE;
-- Admission of generation uses the actual service role, still no model call.
CREATE FUNCTION pg_temp.start_generation(guard jsonb) RETURNS void LANGUAGE sql AS $$
 INSERT INTO public.differentiation_families(id,source_id,family_id,created_by,target_level,referential_version,source_content_hash,generation_status,payload)
 VALUES('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','LOCAL-GENERATION','10000000-0000-4000-8000-000000000001','B1','co-a2-1.2','sha256:'||repeat('a',64),'generating',jsonb_build_object('generation_facts_guard',guard));
$$;
SET LOCAL ROLE service_role;
DO $$ BEGIN
 BEGIN
  PERFORM pg_temp.start_generation('{}');
  RAISE EXCEPTION 'UNCONFIRMED_GENERATION_SUCCEEDED';
 EXCEPTION WHEN serialization_failure THEN
  IF SQLERRM<>'FACTS_CONFIRMATION_REQUIRED' THEN RAISE; END IF;
 END;
 BEGIN
  UPDATE public.differentiation_families SET review_status='archived' WHERE id='30000000-0000-4000-8000-000000000001';
  RAISE EXCEPTION 'REVISED_ARCHIVE_SUCCEEDED';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'FACTS_REVISION_REGENERATION_FORBIDDEN' THEN RAISE; END IF;
 END;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
UPDATE public.pedagogical_sources SET metadata=jsonb_build_object('studio_facts_confirmation',jsonb_build_object('facts_hash','sha256:789e1ad302f7330cdec301db2f5ec3e7f1fa69f2fa4f15a5a3c9624d7d4acd04','confirmed_by',auth.uid())) WHERE id='20000000-0000-4000-8000-000000000001';
RESET ROLE;
SET LOCAL ROLE service_role;
DO $$ DECLARE guard jsonb; BEGIN
 FOREACH guard IN ARRAY ARRAY['{}'::jsonb,'{"facts_hash":"stale","correctif_05a_c":true}'::jsonb,'{"facts_hash":"sha256:789e1ad302f7330cdec301db2f5ec3e7f1fa69f2fa4f15a5a3c9624d7d4acd04","correctif_05a_c":"true"}'::jsonb] LOOP
  BEGIN
   PERFORM pg_temp.start_generation(guard);
   RAISE EXCEPTION 'STALE_GENERATION_SUCCEEDED';
  EXCEPTION WHEN serialization_failure THEN
   IF SQLERRM<>'FACTS_GENERATION_REVISION_CONFLICT' THEN RAISE; END IF;
  END;
 END LOOP;
 PERFORM pg_temp.start_generation('{"facts_hash":"sha256:789e1ad302f7330cdec301db2f5ec3e7f1fa69f2fa4f15a5a3c9624d7d4acd04","correctif_05a_c":true}');
END $$;
RESET ROLE;
ROLLBACK;
\echo 'facts_revision_local: PASS (transaction rolled back)'
