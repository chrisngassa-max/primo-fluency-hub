"""P0 integration tests: new disposable PostgreSQL 17, --network none, no ports.
Never reads .env, project ref, Supabase token or any database connection URL.
"""
import concurrent.futures
import copy
import json
import os
from pathlib import Path
import subprocess
import time
import uuid

ROOT = Path(__file__).resolve().parents[2]
DOCKER = str(Path(os.environ['LOCALAPPDATA']) / 'Programs/DockerDesktop/resources/bin/docker.exe')
NAME = 'captcf-p0-local-' + uuid.uuid4().hex[:12]
DB = 'captcf_p0_test'
OWNER, OTHER, LEARNER, OUTSIDER = [f'10000000-0000-4000-8000-00000000000{i}' for i in range(1, 5)]
GROUP, SESSION, POINT, LEGACY, VALID = [f'20000000-0000-4000-8000-00000000000{i}' for i in range(1, 6)]
MIGRATION = ROOT / 'supabase/migrations/20261001074826_safe_automatic_homework.sql'
ROLLBACK = ROOT / 'supabase/secours/20261001074826_safe_automatic_homework_rollback.sql'
LOG = ROOT / '.local-security-evidence' / NAME
EX = {'titre': 'Rendez-vous', 'consigne': 'Lis et choisis.', 'competence': 'CE', 'format': 'qcm',
      'niveau_vise': 'A2', 'difficulte': 3, 'point_a_maitriser_id': POINT,
      'contenu': {'texte': 'Le rendez-vous est mardi.', 'items': [{'question': 'Quel jour ?', 'options': ['Mardi', 'Jeudi'], 'bonne_reponse': 'Mardi'}]}}


def docker(*args, input=None, check=True):
    p = subprocess.run([DOCKER, '--context', 'desktop-linux', *args], input=input, encoding='utf-8', capture_output=True)
    if check and p.returncode:
        raise AssertionError(p.stderr + p.stdout)
    return p


def q(value):
    return "'" + str(value).replace("'", "''") + "'"


def sql(query, uid=None, role=None, error=None):
    prefix = 'BEGIN; SET LOCAL lock_timeout=\'8s\'; SET LOCAL statement_timeout=\'20s\';'
    if uid or role:
        prefix += 'SET LOCAL ROLE ' + (role or 'authenticated') + ';'
    if uid:
        prefix += "SELECT set_config('request.jwt.claim.sub'," + q(uid) + ',true);'
    p = docker('exec', '-i', NAME, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', DB,
               input=prefix+query+';COMMIT;', check=False)
    if error:
        assert p.returncode and error in p.stderr, (error, p.stdout, p.stderr)
        return
    assert p.returncode == 0, p.stderr
    lines = [line for line in p.stdout.splitlines() if line and line != uid]
    return lines[-1] if lines else ''


def file_sql(path, error=None):
    p = docker('exec', '-i', NAME, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', DB,
               input=path.read_text(encoding='utf-8-sig'), check=False)
    if error:
        assert p.returncode and error in p.stderr, p.stderr
    else:
        assert p.returncode == 0, p.stderr


def entries(ex=None, student=LEARNER):
    return [{'student_id': student, 'serie': 1, 'exercise': copy.deepcopy(ex or EX)}]


def call(payload=None, request=None, group=GROUP, session=SESSION, deadline='2099-01-01T23:59:00Z'):
    return 'SELECT public.send_automatic_homework('+','.join([
        q(request or str(uuid.uuid4()))+'::uuid', q(session)+'::uuid', q(group)+'::uuid',
        q(deadline)+'::timestamptz', q(json.dumps(payload if payload is not None else entries(), ensure_ascii=False))+'::jsonb'])+')'


def insert_ex(ex, id=None, owner=OWNER, is_devoir=False):
    return 'INSERT INTO public.exercices(id,formateur_id,point_a_maitriser_id,titre,consigne,competence,format,niveau_vise,difficulte,contenu,is_devoir) VALUES('+','.join([
        q(id or str(uuid.uuid4())), q(owner), q(ex['point_a_maitriser_id']), q(ex['titre']), q(ex['consigne']), q(ex['competence']), q(ex['format']),
        q(ex['niveau_vise']), str(ex['difficulte']), q(json.dumps(ex['contenu']))+'::jsonb', str(is_devoir).lower()])+')'


def assign(ex=VALID, owner=OWNER):
    return f"INSERT INTO public.devoirs(exercice_id,eleve_id,formateur_id,session_id) VALUES('{ex}','{LEARNER}','{owner}','{SESSION}')"


def snapshot():
    return sql("SELECT jsonb_build_array((SELECT jsonb_agg(to_jsonb(e)-'p0_homework_executable' ORDER BY id) FROM public.exercices e),"
               "(SELECT jsonb_agg(to_jsonb(d)-'p0_requires_executable' ORDER BY id) FROM public.devoirs d),"
               "(SELECT jsonb_agg(to_jsonb(a)-'p0_requires_executable' ORDER BY id) FROM public.exercise_assignments a))")


def counts():
    return sql('SELECT jsonb_build_array((SELECT count(*) FROM public.exercices),(SELECT count(*) FROM public.devoirs),'
               '(SELECT count(*) FROM public.exercise_assignments),(SELECT count(*) FROM homework_private.receipts))')


def main():
    assert docker('context', 'inspect', 'desktop-linux', '--format', '{{.Endpoints.docker.Host}}').stdout.strip().startswith('npipe://'), 'LOCAL_DOCKER_REQUIRED'
    LOG.mkdir(parents=True)
    docker('run', '-d', '--name', NAME, '--label', 'captcf.p0-local=true', '--network', 'none',
           '--mount', 'type=tmpfs,destination=/var/lib/postgresql/data', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', '-e', 'POSTGRES_DB='+DB, 'postgres:17-bookworm')
    try:
        for _ in range(40):
            if docker('exec', NAME, 'pg_isready', '-U', 'postgres', check=False).returncode == 0:
                break
            time.sleep(.25)
        file_sql(ROOT / 'supabase/tests/homework_p0_schema.sql')
        file_sql(ROOT / 'supabase/migrations/20260416200037_9ec38d95-f2e3-400c-a5f1-153f9ab10599.sql')
        sql('CREATE TRIGGER mirror AFTER INSERT OR UPDATE ON public.devoirs FOR EACH ROW EXECUTE FUNCTION public.mirror_devoir_to_assignment()')
        sql('INSERT INTO public.profiles VALUES '+','.join('('+q(uid)+')' for uid in [OWNER, OTHER, LEARNER, OUTSIDER])+
            f"; INSERT INTO public.user_roles VALUES('{OWNER}','formateur'),('{OTHER}','formateur'),('{LEARNER}','eleve'),('{OUTSIDER}','admin');"
            f"INSERT INTO public.groups VALUES('{GROUP}','{OWNER}'); INSERT INTO public.sessions VALUES('{SESSION}','{GROUP}');"
            f"INSERT INTO public.group_members(group_id,eleve_id) VALUES('{GROUP}','{LEARNER}'); INSERT INTO public.points_a_maitriser VALUES('{POINT}')")
        invalid = copy.deepcopy(EX); invalid['contenu'] = {}
        sql(insert_ex(invalid, LEGACY)+';'+insert_ex(EX, VALID)+f";UPDATE public.exercices SET statut='published' WHERE id='{VALID}'")
        # Legacy assignment by a different trainer is invisible to the exercise owner under RLS.
        sql(assign(LEGACY)+';'+assign(VALID, OTHER))
        before = snapshot()
        file_sql(MIGRATION)
        assert snapshot() == before
        print('PASS install: all historical content, homework and mirrors unchanged', flush=True)
        # Preserve simple status edits of legacy incomplete homework and exercise.
        sql(f"UPDATE public.devoirs SET statut='fait' WHERE exercice_id='{LEGACY}'", OWNER)
        sql(f"UPDATE public.exercices SET statut='draft' WHERE id='{LEGACY}'", OWNER)
        print('PASS historical status updates without backfill', flush=True)
        for role, actor, message in [('anon', None, 'permission denied'), ('authenticated', None, 'homework_forbidden'),
                                     ('authenticated', LEARNER, 'homework_forbidden'), ('authenticated', OUTSIDER, 'homework_forbidden'),
                                     ('authenticated', OTHER, 'homework_group_forbidden')]:
            sql(call(), actor, role, error=message)
        sql(call(entries(student=OUTSIDER)), OWNER, error='homework_student_forbidden')
        sql(call(session=str(uuid.uuid4())), OWNER, error='homework_session_forbidden')
        sql(call(deadline='2000-01-01'), OWNER, error='homework_invalid_deadline')
        sql(call(entries(ex={**EX, 'formateur_id': OTHER})), OWNER, error='homework_inexecutable')
        print('PASS auth, roles, ownership, membership, date, identity injection', flush=True)
        sql("DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE (n.nspname='homework_private' OR p.proname='send_automatic_homework') AND (p.prosecdef OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog'] OR has_function_privilege('anon',p.oid,'execute'))) THEN RAISE EXCEPTION 'unsafe_function'; END IF; END $$")
        sql("SELECT * FROM homework_private.receipts", role='anon', error='permission denied')
        sql("UPDATE homework_private.receipts SET payload_hash='forged'", OWNER, error='permission denied')
        print('PASS all new functions INVOKER, fixed search_path, anon denied, receipts immutable', flush=True)
        fixtures = json.loads((ROOT / 'supabase/tests/homework_executable_cases.json').read_text(encoding='utf-8'))
        for case in fixtures:
            value = sql('SELECT homework_private.executable('+q(json.dumps(case['exercise']))+'::jsonb)', OWNER)
            assert (value == 't') == case['valid'], (case['name'], value)
        print(f'PASS {len(fixtures)} format/support contract fixtures (shared with frontend)', flush=True)
        for content in [{}, {'texte':'Texte','items':[]}, {'texte':'Texte','items':[{'question':'Q'}]}]:
            bad=copy.deepcopy(EX); bad['contenu']=content
            sql(call(entries(bad)), OWNER, error='homework_inexecutable')
            sql(insert_ex(bad, is_devoir=True), OWNER, error='homework_inexecutable')
            draft=str(uuid.uuid4()); sql(insert_ex(bad, draft), OWNER)
            sql(assign(draft), OWNER, error='homework_inexecutable')
        # Even assignments invisible through RLS protect an exercise via RI, without DEFINER.
        sql(f"UPDATE public.exercices SET contenu='{{}}' WHERE id='{VALID}'", OWNER, error='p0_homework_executable_fk')
        sql(f"UPDATE public.exercices SET p0_homework_executable=true,contenu='{{}}' WHERE id='{VALID}'", OWNER, error='p0_homework_executable_fk')
        sql(assign(LEGACY), OWNER, error='homework_inexecutable')
        sql(f"INSERT INTO public.exercise_assignments(exercise_id,learner_id,assigned_by) VALUES('{LEGACY}','{LEARNER}','{OWNER}')", OWNER, error='homework_inexecutable')
        mirror_only=str(uuid.uuid4()); sql(insert_ex(EX,mirror_only),OWNER)
        sql(f"INSERT INTO public.exercise_assignments(exercise_id,learner_id,assigned_by) VALUES('{mirror_only}','{LEARNER}','{OWNER}')",OWNER)
        sql(f"UPDATE public.exercices SET contenu='{{}}' WHERE id='{mirror_only}'",OWNER,error='p0_assignment_executable_fk')
        print('PASS direct writes rejected, drafts preserved, cross-owner hidden assignments protected', flush=True)
        # A bare original-audio reference is not enough: resolve its actual publication chain.
        audio_id,source_id,family_id=[str(uuid.uuid4()) for _ in range(3)]
        audio=copy.deepcopy(EX); audio['competence']='CO'
        audio['contenu']={'audio':{'source_id':source_id,'source_content_hash':'sha256:fixture'},'items':EX['contenu']['items']}
        sql(insert_ex(audio,audio_id),OWNER)
        sql(assign(audio_id),OWNER,error='homework_inexecutable')
        sql(call(entries(audio)),OWNER,error='homework_original_audio_use_manual')
        # Editing the draft before publication is allowed and marks it non-distributable.
        sql(f"UPDATE public.exercices SET titre='Audio prêt à publier' WHERE id='{audio_id}'",OWNER)
        sql(f"INSERT INTO public.pedagogical_sources VALUES('{source_id}','{OWNER}','audio','sha256:fixture','analyzed','utilisable','audio','fixture.mp3');"
            f"INSERT INTO public.differentiation_families VALUES('{family_id}','{audio_id}','{source_id}','sha256:fixture','published')")
        sql(assign(audio_id),OWNER)
        broken=copy.deepcopy(audio['contenu']); broken['audio']['source_content_hash']='sha256:wrong'
        sql(f"UPDATE public.exercices SET contenu={q(json.dumps(broken))}::jsonb WHERE id='{audio_id}'",OWNER,error='p0_homework_executable_fk')
        print('PASS original audio: missing publication refused, published manual accepted, broken assigned reference refused',flush=True)
        # Real mid-loop error AFTER the first exercise, homework and mirror insert.
        batch=entries()+entries(); batch[1]['exercise']['point_a_maitriser_id']=str(uuid.uuid4())
        before_counts=counts(); sql(call(batch), OWNER, error='foreign key constraint'); assert counts()==before_counts
        print('PASS failure in middle: zero exercises, homework, mirrors or receipts retained', flush=True)
        request=str(uuid.uuid4()); command=call(request=request)
        result=sql(command, OWNER); before_counts=counts(); assert sql(command,OWNER)==result and counts()==before_counts
        changed=entries(); changed[0]['exercise']['titre']='Changed'; sql(call(changed,request=request),OWNER,error='homework_request_conflict')
        assert sql('SELECT count(*) FROM homework_private.receipts',OTHER)=='0'
        print('PASS successful batch and stable receipt, replay without duplicates, payload conflict and receipt RLS',flush=True)
        # Two actual independent sessions replaying the same request.
        command=call(request=str(uuid.uuid4())); start=json.loads(counts())
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            results=list(pool.map(lambda _:sql(command,OWNER),range(2)))
        assert results[0]==results[1] and json.loads(counts())==[n+1 for n in start]
        print('PASS concurrent same-request replay: one batch',flush=True)
        # Synchronize using a real server-side advisory lock rather than arbitrary polling of results.
        for edit_first in [True,False]:
            exid=str(uuid.uuid4()); sql(insert_ex(EX,exid))
            edit=f"UPDATE public.exercices SET contenu='{{}}' WHERE id='{exid}'"
            assignment=assign(exid)
            first=edit if edit_first else assignment
            second=assignment if edit_first else edit
            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
                future=pool.submit(sql, first+';SELECT pg_advisory_xact_lock(819273);SELECT pg_sleep(1.5)', OWNER)
                for _ in range(60):
                    if sql("SELECT EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND objid=819273 AND granted)")=='t': break
                    time.sleep(.025)
                else: raise AssertionError('concurrency barrier not reached')
                sql(second,OWNER,error='homework_inexecutable' if edit_first else 'p0_homework_executable_fk')
                future.result()
        print('PASS both concurrency orders: edit/assignment cannot distribute an invalid exercise',flush=True)
        # Refusal is itself tested first; nothing may be destroyed to force rollback in production.
        before=snapshot(); file_sql(ROLLBACK,error='p0_rollback_refused_nonempty_receipts'); assert snapshot()==before
        receipts=sql('SELECT jsonb_agg(to_jsonb(r)) FROM homework_private.receipts r')
        (LOG/'receipts-fixtures-only.json').write_text(receipts,encoding='utf-8')
        # Only our isolated fixture receipts are removed, after local archive, for rollback validation.
        sql('DELETE FROM homework_private.receipts')
        before=snapshot(); file_sql(ROLLBACK); assert snapshot()==before
        assert sql("SELECT to_regnamespace('homework_private') IS NULL")=='t'
        print('PASS rollback refusal when nonempty, then isolated-fixture rollback: business data unchanged',flush=True)
        (LOG/'result.txt').write_text('PASS all P0 PostgreSQL tests; container network none; no remote connection\n',encoding='utf-8')
    finally:
        # Only the freshly generated, labelled test container; never prune/remove user containers.
        docker('rm','-f',NAME,check=False)


if __name__ == '__main__':
    main()
