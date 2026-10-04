# PostgreSQL isolationtester; ONLY disposable local database with project schema.
setup
{
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


}
teardown
{
 DELETE FROM public.differentiation_families WHERE id='30000000-0000-4000-8000-000000000001';
 DELETE FROM public.pedagogical_sources WHERE id='20000000-0000-4000-8000-000000000001';
 DELETE FROM auth.users WHERE id IN ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003');
}
session "one"
step "begin1" { BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true); }
step "context1" { SELECT current_user,auth.uid(); }
step "save1" { SELECT public.revise_differentiation_facts_atomically('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','sha256:0613abe1727a710cdccb212acff28301b26ece9ffead7605ef6c4cea359881f4',1,(SELECT updated_at FROM public.pedagogical_sources WHERE id='20000000-0000-4000-8000-000000000001'),'[{"fact_id":"fact_01","subject":"Charlotte","predicate":"explique","object":"revision"}]'); }
step "commit1" { COMMIT; }
session "two"
step "begin2" { BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true); }
step "context2" { SELECT current_user,auth.uid(); }
step "save2" { SELECT public.revise_differentiation_facts_atomically('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','sha256:0613abe1727a710cdccb212acff28301b26ece9ffead7605ef6c4cea359881f4',1,(SELECT updated_at FROM public.pedagogical_sources WHERE id='20000000-0000-4000-8000-000000000001'),'[{"fact_id":"fact_01","subject":"Charlotte","predicate":"explique","object":"revision"}]'); }
step "rollback2" { ROLLBACK; }
session "observer"
step "check" { SELECT (payload->>'version')::int=2 AS exactly_one_revision,review_status='draft' AS still_draft FROM public.differentiation_families WHERE id='30000000-0000-4000-8000-000000000001'; }
# save2 waits for commit1, then must fail FACTS_REVISION_CONFLICT; check => true,true.
permutation "begin1" "context1" "begin2" "context2" "save1" "save2" "commit1" "rollback2" "check"