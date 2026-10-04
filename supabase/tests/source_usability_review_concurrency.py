"""Prepared two-connection integration test, LOCAL disposable Supabase only.

Requires psql on PATH, local migrated DB on 127.0.0.1:54322 and PGPASSWORD
provided by the operator. Does not apply migrations. Run after the SQL test.
Fixtures are committed for concurrency, then removed in finally.
"""
import subprocess
import time
from pathlib import Path

SOURCE = "b5000000-0000-0000-0000-000000000001"
OWNER = "a5000000-0000-0000-0000-000000000001"
USERS = ",".join(f"'a5000000-0000-0000-0000-{number:012d}'" for number in range(1, 5))
CMD = ["psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-h", "127.0.0.1", "-p", "54322", "-U", "postgres", "-d", "postgres"]

def sql(query, check=True):
    return subprocess.run(CMD, input=query, text=True, capture_output=True, check=check)

def call(version):
    return f"SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','{OWNER}',true); SELECT changed FROM public.mark_pedagogical_source_usable('{SOURCE}',true,'{version}');"

def race(holder_action, expected, succeeds=True):
    version = sql(f"SELECT updated_at FROM public.pedagogical_sources WHERE id='{SOURCE}';").stdout.strip()
    holder = subprocess.Popen(CMD, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    holder.stdin.write(f"BEGIN; SET LOCAL application_name='source-review-concurrency-holder'; {holder_action(version)} SELECT pg_sleep(2); COMMIT;")
    holder.stdin.close()
    try:
        # Wait until holder owns the source lock, not an assumed scheduling delay.
        deadline = time.monotonic() + 10
        while sql("SELECT count(*) FROM pg_stat_activity WHERE application_name='source-review-concurrency-holder' AND wait_event='PgSleep';").stdout.strip() != "1":
            if time.monotonic() > deadline or holder.poll() is not None:
                raise AssertionError("Holder failed to reach transaction barrier")
            time.sleep(.05)
        follower = sql("BEGIN; " + call(version) + " COMMIT;", check=False)
        holder.wait(timeout=10)
        assert holder.returncode == 0, holder.stderr.read()
        assert (follower.returncode == 0) == succeeds, follower.stderr
        assert expected in (follower.stdout.splitlines() if succeeds else follower.stderr), follower
        return holder.stdout.read()
    finally:
        if holder.poll() is None:
            holder.terminate()
            holder.wait(timeout=10)

fixture = Path(__file__).with_name("source_usability_review_test.sql").read_text(encoding="utf-8").split("-- Snapshot every business field")[0]
created = False
try:
    sql(fixture + "\nCOMMIT;")
    created = True
    first = race(call, "f")
    assert "t" in first.splitlines(), first  # exactly one changed=true
    assert sql(f"SELECT review_status FROM public.pedagogical_sources WHERE id='{SOURCE}';").stdout.strip() == "utilisable"
    sql(f"UPDATE public.pedagogical_sources SET review_status='brouillon' WHERE id='{SOURCE}';")
    race(lambda _: f"UPDATE public.pedagogical_sources SET rights_status=NULL WHERE id='{SOURCE}';", "SOURCE_RIGHTS_REQUIRED", False)
    assert sql(f"SELECT review_status FROM public.pedagogical_sources WHERE id='{SOURCE}';").stdout.strip() == "brouillon"
    sql(f"UPDATE public.pedagogical_sources SET rights_status='internal_pilot' WHERE id='{SOURCE}';")
    race(lambda _: f"UPDATE public.pedagogical_sources SET review_status='a_remplacer' WHERE id='{SOURCE}';", "SOURCE_REVIEW_INVALID_STATE", False)
    sql(f"UPDATE public.pedagogical_sources SET review_status='brouillon' WHERE id='{SOURCE}';")
    race(lambda _: f"UPDATE public.pedagogical_sources SET title='Changed after dialog' WHERE id='{SOURCE}';", "SOURCE_REVIEW_CONFLICT", False)
    assert sql(f"SELECT review_status FROM public.pedagogical_sources WHERE id='{SOURCE}';").stdout.strip() == "brouillon"
    print("PASS: simultaneous confirmation, one effect, invalidation, status race, stale dialog")
finally:
    if created:
        sql(f"BEGIN; DELETE FROM public.pedagogical_sources WHERE id='{SOURCE}'; DELETE FROM public.user_roles WHERE user_id IN ({USERS}); DELETE FROM public.profiles WHERE id IN ({USERS}); DELETE FROM auth.users WHERE id IN ({USERS}); COMMIT;")
