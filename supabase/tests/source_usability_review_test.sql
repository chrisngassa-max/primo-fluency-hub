-- LOCAL DISPOSABLE DATABASE ONLY, migration already installed by test operator.
-- psql -X -v ON_ERROR_STOP=1 -f supabase/tests/source_usability_review_test.sql
-- No migration is applied by this test. All fixtures are rolled back.
\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.expect_error(statement text, expected text) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE actual text;
BEGIN
  BEGIN EXECUTE statement; EXCEPTION WHEN OTHERS THEN actual := SQLERRM; END;
  IF actual IS NULL OR position(expected IN actual)=0 THEN
    RAISE EXCEPTION 'Expected %, got %', expected, coalesce(actual,'SUCCESS');
  END IF;
END $$;

INSERT INTO auth.users(id,email) VALUES
 ('a5000000-0000-0000-0000-000000000001','source-owner@test.local'),
 ('a5000000-0000-0000-0000-000000000002','source-other@test.local'),
 ('a5000000-0000-0000-0000-000000000003','source-student@test.local'),
 ('a5000000-0000-0000-0000-000000000004','source-admin@test.local');
INSERT INTO public.profiles(id,email,nom,prenom)
 SELECT id,email,'Test','Source' FROM auth.users WHERE id::text LIKE 'a5000000-%'
 ON CONFLICT(id) DO NOTHING;
INSERT INTO public.user_roles(user_id,role) VALUES
 ('a5000000-0000-0000-0000-000000000001','formateur'),
 ('a5000000-0000-0000-0000-000000000002','formateur'),
 ('a5000000-0000-0000-0000-000000000003','eleve'),
 ('a5000000-0000-0000-0000-000000000004','admin') ON CONFLICT DO NOTHING;
INSERT INTO public.pedagogical_sources(id,title,created_by,source_kind,status,storage_path,content_hash,rights_status)
 VALUES('b5000000-0000-0000-0000-000000000001','Review test','a5000000-0000-0000-0000-000000000001','audio','analyzed','local-test.mp3','sha256:'||repeat('a',64),'internal_pilot');
INSERT INTO public.pedagogical_source_transcriptions(id,source_id,status,reviewed_text,reviewed_by,reviewed_at)
 VALUES('c5000000-0000-0000-0000-000000000001','b5000000-0000-0000-0000-000000000001','reviewed','Texte corrigé','a5000000-0000-0000-0000-000000000001',now());
INSERT INTO public.pedagogical_source_chunks(source_id,content_text)
 VALUES('b5000000-0000-0000-0000-000000000001','Texte corrigé');
-- Snapshot every business field; only review_status/updated_at may change.
CREATE TEMP TABLE before_source AS SELECT to_jsonb(s)-'review_status'-'updated_at' AS payload FROM public.pedagogical_sources s WHERE id='b5000000-0000-0000-0000-000000000001';
GRANT SELECT ON before_source TO authenticated;
SELECT updated_at AS original_version FROM public.pedagogical_sources WHERE id='b5000000-0000-0000-0000-000000000001' \gset

SET LOCAL ROLE anon;
SELECT pg_temp.expect_error($q$SELECT * FROM public.mark_pedagogical_source_usable('b5000000-0000-0000-0000-000000000001',true,now())$q$,'permission denied');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','a5000000-0000-0000-0000-000000000003',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_error($q$SELECT * FROM public.mark_pedagogical_source_usable('b5000000-0000-0000-0000-000000000001',true,now())$q$,'STAFF_ROLE_REQUIRED');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','a5000000-0000-0000-0000-000000000002',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_error($q$SELECT * FROM public.mark_pedagogical_source_usable('b5000000-0000-0000-0000-000000000001',true,now())$q$,'SOURCE_FORBIDDEN');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','a5000000-0000-0000-0000-000000000001',true);
SET LOCAL ROLE authenticated;
-- A browser-controlled GUC/JWT role string cannot change effective current_user.
SELECT set_config('app.source_review_allowed','true',true);
SELECT set_config('request.jwt.claim.role','service_role',true);
SELECT pg_temp.expect_error($q$UPDATE public.pedagogical_sources SET review_status='utilisable' WHERE id='b5000000-0000-0000-0000-000000000001'$q$,'SOURCE_REVIEW_DIRECT_WRITE_FORBIDDEN');
SELECT pg_temp.expect_error($q$UPDATE public.pedagogical_sources SET review_status='valide' WHERE id='b5000000-0000-0000-0000-000000000001'$q$,'SOURCE_REVIEW_DIRECT_WRITE_FORBIDDEN');
-- Do not assert SET ROLE postgres is denied in an administrative session.
-- session_user remains postgres; real client isolation is tested over HTTP/JWT.
SELECT pg_temp.expect_error($q$INSERT INTO public.pedagogical_sources(title,storage_path,created_by,review_status) VALUES('Bypass','x','a5000000-0000-0000-0000-000000000001','utilisable')$q$,'SOURCE_REVIEW_DIRECT_WRITE_FORBIDDEN');
SELECT pg_temp.expect_error($q$SELECT * FROM public.mark_pedagogical_source_usable('b5000000-0000-0000-0000-000000000001',false,now())$q$,'SOURCE_REVIEW_CONFIRMATION_REQUIRED');
SELECT pg_temp.expect_error($q$SELECT * FROM public.mark_pedagogical_source_usable('b5000000-0000-0000-0000-000000000001',true,'2000-01-01')$q$,'SOURCE_REVIEW_CONFLICT');
-- Invalid prerequisites: each failure must leave review_status untouched.
RESET ROLE;
CREATE FUNCTION pg_temp.check_prerequisite(mutation text, expected text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE mutation;
    SET LOCAL ROLE authenticated;
    PERFORM pg_temp.expect_error($q$SELECT * FROM public.mark_pedagogical_source_usable('b5000000-0000-0000-0000-000000000001',true,now())$q$,expected);
    IF (SELECT review_status FROM public.pedagogical_sources WHERE id='b5000000-0000-0000-0000-000000000001') <> 'brouillon' THEN RAISE EXCEPTION 'Partial transition'; END IF;
    RAISE EXCEPTION 'fixture rollback' USING ERRCODE='ZX001';
  EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL; END;
END $$;
SELECT pg_temp.check_prerequisite($q$DELETE FROM public.pedagogical_source_transcriptions WHERE source_id='b5000000-0000-0000-0000-000000000001'$q$,'TRANSCRIPTION_NOT_FOUND');
SELECT pg_temp.check_prerequisite($q$UPDATE public.pedagogical_source_transcriptions SET status='ready' WHERE source_id='b5000000-0000-0000-0000-000000000001'$q$,'REVIEWED_TRANSCRIPTION_REQUIRED');
SELECT pg_temp.check_prerequisite($q$UPDATE public.pedagogical_sources SET status='imported' WHERE id='b5000000-0000-0000-0000-000000000001'$q$,'SOURCE_NOT_ANALYZED');
SELECT pg_temp.check_prerequisite($q$DELETE FROM public.pedagogical_source_chunks WHERE source_id='b5000000-0000-0000-0000-000000000001'$q$,'SOURCE_NOT_ANALYZED');
SELECT pg_temp.check_prerequisite($q$UPDATE public.pedagogical_sources SET rights_status=' ' WHERE id='b5000000-0000-0000-0000-000000000001'$q$,'SOURCE_RIGHTS_REQUIRED');
SELECT pg_temp.check_prerequisite($q$UPDATE public.pedagogical_sources SET reusable_for_ai=false WHERE id='b5000000-0000-0000-0000-000000000001'$q$,'SOURCE_RIGHTS_REQUIRED');
SELECT pg_temp.check_prerequisite($q$UPDATE public.pedagogical_sources SET content_hash=NULL WHERE id='b5000000-0000-0000-0000-000000000001'$q$,'SOURCE_HASH_REQUIRED');
SET LOCAL ROLE authenticated;
-- First confirmation is the only change, repeat is a no-op even with old version.
SELECT * FROM public.mark_pedagogical_source_usable('b5000000-0000-0000-0000-000000000001',true,:'original_version') \gset first_
SELECT * FROM public.mark_pedagogical_source_usable('b5000000-0000-0000-0000-000000000001',true,:'original_version') \gset repeat_
SELECT 1 / (:'first_changed'::boolean AND NOT :'repeat_changed'::boolean AND :'first_updated_at'::timestamptz=:'repeat_updated_at'::timestamptz)::int;
DO $$ BEGIN
 IF (SELECT to_jsonb(s)-'review_status'-'updated_at' FROM public.pedagogical_sources s WHERE id='b5000000-0000-0000-0000-000000000001') IS DISTINCT FROM (SELECT payload FROM before_source) THEN RAISE EXCEPTION 'Unrelated business field changed'; END IF;
END $$;
UPDATE public.pedagogical_sources SET title='Legitimate edit' WHERE id='b5000000-0000-0000-0000-000000000001';
DO $$ BEGIN IF (SELECT title FROM public.pedagogical_sources WHERE id='b5000000-0000-0000-0000-000000000001') <> 'Legitimate edit' THEN RAISE EXCEPTION 'Title update blocked'; END IF; END $$;
RESET ROLE;
-- Existing admin exception permits a non-owner admin; trusted writes still work.
UPDATE public.pedagogical_sources SET review_status='brouillon' WHERE id='b5000000-0000-0000-0000-000000000001';
SELECT updated_at AS admin_version FROM public.pedagogical_sources WHERE id='b5000000-0000-0000-0000-000000000001' \gset
SELECT set_config('request.jwt.claim.sub','a5000000-0000-0000-0000-000000000004',true);
SET LOCAL ROLE authenticated;
SELECT * FROM public.mark_pedagogical_source_usable('b5000000-0000-0000-0000-000000000001',true,:'admin_version') \gset admin_
SELECT 1 / :'admin_changed'::boolean::int;
RESET ROLE;
UPDATE public.pedagogical_sources SET review_status='a_remplacer' WHERE id='b5000000-0000-0000-0000-000000000001';
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_error($q$SELECT * FROM public.mark_pedagogical_source_usable('b5000000-0000-0000-0000-000000000001',true,now())$q$,'SOURCE_REVIEW_INVALID_STATE');
RESET ROLE;
ROLLBACK;
