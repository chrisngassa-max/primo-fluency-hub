-- Local isolated PostgreSQL only. The runner supplies expected_state before this file.
BEGIN;
SELECT set_config('test.expected_sqlstate', :'expected_state', true);
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
 ('20000000-0000-4000-8000-000000000001','LOCAL facts test','local/fixture.mp3','10000000-0000-4000-8000-000000000001','{}');
INSERT INTO public.differentiation_families(id,source_id,family_id,created_by,target_level,referential_version,source_content_hash,generation_status,generation_completed_at,payload) VALUES
 ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','LOCAL-FACTS-TEST','10000000-0000-4000-8000-000000000001','A2','co-a2-1.2','sha256:'||repeat('a',64),'generated',now(),
 '{"version":1,"facts":{"facts_hash":"sha256:0613abe1727a710cdccb212acff28301b26ece9ffead7605ef6c4cea359881f4","required":[{"fact_id":"fact_01","subject":"Charlotte","predicate":"explique","object":"fait 1","semantic_qualifiers":{"speaker":"Charlotte"},"required_for_task":true,"provenance":{"quote":"immutable proof"}},{"fact_id":"fact_02","subject":"Charlotte","predicate":"explique","object":"fait 2","semantic_qualifiers":{"speaker":"Charlotte"},"required_for_task":true,"provenance":{"quote":"second proof"}}]},"variants":{"A2":{"exercise":{"items":[{"id":"q1","fact_refs":["fact_01"]}]}}}}');


SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
DO $$ DECLARE before_source jsonb; before_family jsonb; actual_state text; actual_message text; started timestamptz:=clock_timestamp(); BEGIN
 SELECT to_jsonb(s) INTO before_source FROM public.pedagogical_sources s WHERE id='20000000-0000-4000-8000-000000000001';
 SELECT to_jsonb(f) INTO before_family FROM public.differentiation_families f WHERE id='30000000-0000-4000-8000-000000000001';
 BEGIN
  PERFORM public.revise_differentiation_facts_atomically('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','sha256:'||repeat('0',64),1,(before_source->>'updated_at')::timestamptz,'[{"fact_id":"fact_01","subject":"Charlotte","predicate":"explique","object":"temporary"}]');
  RAISE EXCEPTION 'UNEXPECTED_SUCCESS';
 EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS actual_state=RETURNED_SQLSTATE,actual_message=MESSAGE_TEXT;
 END;
 IF actual_state<>current_setting('test.expected_sqlstate') OR actual_message<>'FACTS_REVISION_CONFLICT' THEN RAISE EXCEPTION 'Wrong conflict: % %',actual_state,actual_message; END IF;
 IF before_source IS DISTINCT FROM (SELECT to_jsonb(s) FROM public.pedagogical_sources s WHERE id='20000000-0000-4000-8000-000000000001') OR before_family IS DISTINCT FROM (SELECT to_jsonb(f) FROM public.differentiation_families f WHERE id='30000000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'CONFLICT_MUTATED_ROWS'; END IF;
 IF clock_timestamp()-started>interval '2 seconds' THEN RAISE EXCEPTION 'CONFLICT_TOO_SLOW'; END IF;
 RAISE NOTICE 'PASS single RPC, SQLSTATE %, elapsed %, no writes',actual_state,clock_timestamp()-started;
END $$;
ROLLBACK;
