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


def main():
    assert db.docker('context','inspect','desktop-linux','--format','{{.Endpoints.docker.Host}}').stdout.strip().startswith('npipe://')
    db.docker('run','-d','--name',db.NAME,'--label','captcf.p0-local=true','--network','none',
              '--mount','type=tmpfs,destination=/var/lib/postgresql/data','-e','POSTGRES_HOST_AUTH_METHOD=trust','-e','POSTGRES_DB='+db.DB,'postgres:17-bookworm')
    try:
        for _ in range(40):
            if db.docker('exec',db.NAME,'pg_isready','-U','postgres',check=False).returncode==0: break
            time.sleep(.25)
        seed()
        regressions()
    finally:
        db.docker('rm','-f',db.NAME,check=False)


if __name__=='__main__':
    main()
