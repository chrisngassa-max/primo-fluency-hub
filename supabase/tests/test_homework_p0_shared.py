"""P0.4 shared exercise regression; disposable local PostgreSQL, no network.

Uses the P0 integration harness and never reads credentials or a remote URL.
"""
import concurrent.futures
import copy
import json
import time
import uuid
import test_homework_p0_local as db

SHARED, DRAFT, INCOMPLETE = [str(uuid.uuid4()) for _ in range(3)]
MARKER = 819275


def independent(ex, actor=db.OWNER, group=db.GROUP, learner=None):
    return ("INSERT INTO public.exercise_assignments(exercise_id,assigned_by,group_id,learner_id,context) VALUES("+
            ','.join('NULL' if v is None else db.q(v) for v in [ex,actor,group,learner])+",'devoir')")


def seed():
    db.file_sql(db.ROOT/'supabase/tests/homework_p0_schema.sql')
    db.sql('INSERT INTO public.profiles VALUES '+','.join('('+db.q(u)+')' for u in [db.OWNER,db.OTHER,db.LEARNER,db.OUTSIDER])+
           f";INSERT INTO public.user_roles VALUES('{db.OWNER}','formateur'),('{db.OTHER}','formateur'),('{db.OUTSIDER}','formateur');"
           f"INSERT INTO public.points_a_maitriser VALUES('{db.POINT}');INSERT INTO public.groups VALUES('{db.GROUP}','{db.OWNER}');"
           f"INSERT INTO public.sessions VALUES('{db.SESSION}','{db.GROUP}');INSERT INTO public.group_members(group_id,eleve_id) VALUES('{db.GROUP}','{db.LEARNER}')")
    bad=copy.deepcopy(db.EX); bad['contenu']['items']=[{'question':'Missing answer'}]
    db.sql(db.insert_ex(db.EX,SHARED,db.OTHER)+';'+db.insert_ex(db.EX,DRAFT,db.OTHER)+';'+db.insert_ex(bad,INCOMPLETE,db.OTHER))
    db.sql(f"UPDATE public.exercices SET statut='published' WHERE id IN ('{SHARED}','{INCOMPLETE}')")
    db.file_sql(db.ROOT/'supabase/tests/homework_p0_existing_guards.sql')


def regressions():
    assert db.sql(f"SELECT count(*) FROM public.exercices WHERE id='{SHARED}'",db.OWNER)=='1'
    assert db.sql(f"SELECT count(*) FROM (SELECT id FROM public.exercices WHERE id='{SHARED}' FOR KEY SHARE) locked",db.OWNER)=='0'
    assert db.sql(f"WITH changed AS (UPDATE public.exercices SET titre='Forbidden' WHERE id='{SHARED}' RETURNING id) SELECT count(*) FROM changed",db.OWNER)=='0'
    db.sql(db.assign(SHARED),db.OWNER)
    db.sql(independent(SHARED),db.OWNER)
    print('PASS BEFORE: shared SELECT, no UPDATE, devoir and group assignment',flush=True)
    db.file_sql(db.MIGRATION)
    failures=[]
    cases=[('shared devoir',db.assign(SHARED),db.OWNER,None),
           ('shared individual',independent(SHARED,learner=db.LEARNER),db.OWNER,None),
           ('shared group NULL learner',independent(SHARED),db.OWNER,None),
           ('draft',db.assign(DRAFT),db.OWNER,'homework_inexecutable'),
           ('incomplete',db.assign(INCOMPLETE),db.OWNER,'homework_inexecutable'),
           ('incomplete independent',independent(INCOMPLETE),db.OWNER,'homework_inexecutable'),
           ('draft independent',independent(DRAFT),db.OWNER,'homework_inexecutable'),
           ('invisible',db.assign(str(uuid.uuid4())),db.OWNER,'homework_inexecutable'),
           ('third party group',independent(SHARED,actor=db.OUTSIDER),db.OUTSIDER,'homework_group_forbidden')]
    for label,command,actor,error in cases:
        before=db.counts()
        try:
            db.sql(command,actor,error=error)
            if error: assert db.counts()==before
            print('PASS '+label,flush=True)
        except AssertionError as exc:
            failures.append(label)
            print('FAIL '+label+': '+str(exc),flush=True)
    assert db.sql(f"WITH changed AS (UPDATE public.exercices SET titre='Forbidden' WHERE id='{SHARED}' RETURNING id) SELECT count(*) FROM changed",db.OWNER)=='0'
    assert not failures, failures


def fresh():
    ident=str(uuid.uuid4())
    db.sql(db.insert_ex(db.EX,ident,db.OTHER)+f";UPDATE public.exercices SET statut='published' WHERE id='{ident}'")
    return ident


def marker_visible():
    return db.sql(f"SELECT EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND objid={MARKER} AND granted)")=='t'


def wait_marker():
    for _ in range(80):
        if marker_visible(): return
        time.sleep(.025)
    raise AssertionError('concurrency barrier not reached')


def race(first, first_actor, second, second_actor, error='homework_exercise_busy'):
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        running=pool.submit(db.sql,first+f';SELECT pg_advisory_xact_lock({MARKER});SELECT pg_sleep(2.5)',first_actor)
        wait_marker()
        db.sql(second,second_actor,error=error)
        if error=='homework_exercise_busy': assert marker_visible(), 'first transaction ended before conflict assertion'
        running.result()


def concurrency():
    bad=db.q(json.dumps({'texte':db.EX['contenu']['texte'],'items':[{'question':'Missing answer'}]}))+'::jsonb'
    for independent_path in [False,True]:
        for edit_first in [False,True]:
            ident=fresh()
            assignment=independent(ident) if independent_path else db.assign(ident)
            edit=f"UPDATE public.exercices SET contenu={bad} WHERE id='{ident}'"
            first,second=(edit,assignment) if edit_first else (assignment,edit)
            race(first,db.OTHER if edit_first else db.OWNER,second,db.OWNER if edit_first else db.OTHER)
            db.sql(second,db.OWNER if edit_first else db.OTHER,error='homework_inexecutable' if edit_first else 'executable_fk')
            print(f'PASS race shared independent={independent_path} edit_first={edit_first}: busy once, correct post-commit outcome',flush=True)

    ident=fresh(); command=independent(ident)
    race(command,db.OWNER,command,db.OWNER)
    assert db.sql(f"SELECT count(*) FROM public.exercise_assignments WHERE exercise_id='{ident}'")=='1'
    # A new intentional action after completion is allowed; no automatic retry.
    db.sql(command,db.OWNER)
    assert db.sql(f"SELECT count(*) FROM public.exercise_assignments WHERE exercise_id='{ident}'")=='2'
    print('PASS two overlapping assignments: one busy/zero partial rows, subsequent explicit action accepted',flush=True)

    one,two=fresh(),fresh()
    race(independent(one),db.OWNER,independent(two),db.OWNER,error=None)
    assert db.sql(f"SELECT count(*) FROM public.exercise_assignments WHERE exercise_id IN ('{one}','{two}')")=='2'
    print('PASS different exercises concurrent: both accepted',flush=True)
    one,two=fresh(),fresh()
    race(independent(two),db.OWNER,independent(one)+';'+independent(two),db.OWNER)
    assert db.sql(f"SELECT count(*) FROM public.exercise_assignments WHERE exercise_id='{one}'")=='0'
    assert db.sql(f"SELECT count(*) FROM public.exercise_assignments WHERE exercise_id='{two}'")=='1'
    print('PASS busy on second shared assignment: whole batch rolled back',flush=True)

    for operation in ['delete','unpublish','hide']:
        for mutation_first in [False,True]:
            ident=fresh(); assignment=db.assign(ident)
            mutation=(f"DELETE FROM public.exercices WHERE id='{ident}'" if operation=='delete' else
                      f"UPDATE public.exercices SET statut='draft'"+(',is_template=true' if operation=='hide' else '')+f" WHERE id='{ident}'")
            if mutation_first:
                race(mutation,db.OTHER,assignment,db.OWNER)
                db.sql(assignment,db.OWNER,error='homework_inexecutable')
            elif operation=='delete':
                # DELETE waits on the FK row lock before its trigger; after commit,
                # normal ON DELETE CASCADE removes the assignment, never an orphan.
                race(assignment,db.OWNER,mutation,db.OTHER,error=None)
                assert db.sql(f"SELECT count(*) FROM public.devoirs WHERE exercice_id='{ident}'")=='0'
            else:
                race(assignment,db.OWNER,mutation,db.OTHER)
                db.sql(mutation,db.OTHER)
                db.sql(assignment,db.OWNER,error='homework_inexecutable')
            print(f'PASS {operation} mutation_first={mutation_first}',flush=True)
            if operation=='hide': assert db.sql(f"SELECT count(*) FROM public.exercices WHERE id='{ident}'",db.OWNER)=='0'

    # Adversarial row-before-advisory order: owner holds FOR UPDATE first.
    # Assignment then owns the advisory lock and waits on its FK check. A blocking
    # advisory lock in the owner's trigger would deadlock. try-lock must abort it.
    ident=fresh()
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        owner=pool.submit(db.sql,f"SELECT id FROM public.exercices WHERE id='{ident}' FOR UPDATE;SELECT pg_advisory_xact_lock({MARKER});SELECT pg_sleep(3);UPDATE public.exercices SET contenu={bad} WHERE id='{ident}'",db.OTHER,None,'homework_exercise_busy')
        wait_marker()
        assignee=pool.submit(db.sql,db.assign(ident),db.OWNER)
        owner.result(); assignee.result()
    print('PASS row-before-advisory/FK inversion: stable busy error, no deadlock',flush=True)

    # UPDATE of an existing assignment also participates, including group changes.
    ident=fresh(); aid=str(uuid.uuid4())
    db.sql(f"INSERT INTO public.exercise_assignments(id,exercise_id,assigned_by,learner_id) VALUES('{aid}','{ident}','{db.OWNER}','{db.LEARNER}')",db.OWNER)
    race(f"UPDATE public.exercise_assignments SET group_id='{db.GROUP}' WHERE id='{aid}'",db.OWNER,
         f"UPDATE public.exercices SET contenu={bad} WHERE id='{ident}'",db.OTHER)
    foreign_group=str(uuid.uuid4())
    db.sql(f"INSERT INTO public.groups VALUES('{foreign_group}','{db.OTHER}')")
    before=db.counts()
    db.sql(f"UPDATE public.exercise_assignments SET group_id='{foreign_group}' WHERE id='{aid}'",db.OWNER,error='homework_group_forbidden')
    assert db.counts()==before
    print('PASS assignment UPDATE versus owner edit',flush=True)
    assert db.sql("SELECT deadlocks FROM pg_stat_database WHERE datname=current_database()")=='0'


def scope_and_atomicity():
    own=str(uuid.uuid4()); db.sql(db.insert_ex(db.EX,own),db.OWNER)
    db.sql(db.assign(own),db.OWNER)
    # Readable draft bank entry must not become assignable for another teacher.
    assert db.sql(f"SELECT count(*) FROM public.exercices WHERE id='{DRAFT}'",db.OWNER)=='1'
    db.sql(f"UPDATE public.exercices SET statut='validated' WHERE id='{DRAFT}'",db.OTHER)
    db.sql(db.assign(DRAFT),db.OWNER,error='homework_inexecutable')
    db.sql(f"UPDATE public.exercices SET statut='draft' WHERE id='{DRAFT}'",db.OTHER)
    db.sql(f"UPDATE public.exercices SET is_template=true WHERE id='{DRAFT}'",db.OTHER)
    assert db.sql(f"SELECT count(*) FROM public.exercices WHERE id='{DRAFT}'",db.OWNER)=='0'
    db.sql(db.assign(DRAFT),db.OWNER,error='homework_inexecutable')
    db.sql(independent(SHARED,learner=db.OUTSIDER),db.OWNER,error='homework_student_forbidden')
    db.sql(db.assign(SHARED,db.OUTSIDER),db.OUTSIDER,error='homework_group_forbidden')
    db.sql("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;"+db.assign(SHARED),error='homework_isolation_unsupported')
    request=str(uuid.uuid4()); command=db.call(request=request)
    start=json.loads(db.counts()); result=db.sql(command,db.OWNER)
    assert json.loads(db.counts())==[start[0]+1,start[1]+1,start[2],start[3]+1]
    before=db.counts(); assert db.sql(command,db.OWNER)==result and db.counts()==before
    changed=db.entries(); changed[0]['exercise']['titre']='Changed'
    db.sql(db.call(changed,request=request),db.OWNER,error='homework_request_conflict')
    batch=db.entries()+db.entries(); batch[1]['exercise']['point_a_maitriser_id']=str(uuid.uuid4())
    before=db.counts(); db.sql(db.call(batch),db.OWNER,error='foreign key constraint'); assert db.counts()==before
    print('PASS scope, stale isolation refused, request replay/conflict, second-exercise rollback, RPC creates zero independent assignments',flush=True)


def main():
    assert db.docker('context','inspect','desktop-linux','--format','{{.Endpoints.docker.Host}}').stdout.strip().startswith('npipe://')
    db.docker('run','-d','--name',db.NAME,'--label','captcf.p0-local=true','--network','none',
              '--mount','type=tmpfs,destination=/var/lib/postgresql/data','-e','POSTGRES_HOST_AUTH_METHOD=trust','-e','POSTGRES_DB='+db.DB,'postgres:17-bookworm')
    try:
        for _ in range(40):
            if db.docker('exec',db.NAME,'pg_isready','-h','127.0.0.1','-U','postgres',check=False).returncode==0: break
            time.sleep(.25)
        seed()
        regressions()
        scope_and_atomicity()
        concurrency()
    finally:
        db.docker('rm','-f',db.NAME,check=False)


if __name__=='__main__':
    main()
