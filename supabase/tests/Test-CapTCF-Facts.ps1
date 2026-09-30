param([string]$Repo = (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent))
$ErrorActionPreference = 'Stop'
$docker = Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\resources\bin\docker.exe'
$container = 'captcf-facts-test-' + [guid]::NewGuid().ToString('N').Substring(0,12)
$runDir = Join-Path $Repo ".local-security-evidence/$container"
$utf8 = New-Object System.Text.UTF8Encoding($false)
[IO.Directory]::CreateDirectory($runDir) | Out-Null
$log = Join-Path $runDir 'resultat.txt'
$created = $false
$success = $false

function Invoke-Docker {
    param([string[]]$CommandArgs)
    $priorPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue' # Windows PowerShell: Docker progress uses stderr.
        $output = & $docker --context desktop-linux @CommandArgs 2>&1
        $code = $LASTEXITCODE
    } finally { $ErrorActionPreference = $priorPreference }
    $output | ForEach-Object { $_.ToString() } | Tee-Object -FilePath $log -Append | Write-Host
    if ($code -ne 0) { throw "Docker a retourne $code : $($CommandArgs -join ' ')" }
}
function Read-Repo([string]$relative) { [IO.File]::ReadAllText((Join-Path $Repo $relative)) }
function Extract-One([string]$sql,[string]$pattern) {
    $matchesFound = [regex]::Matches($sql,$pattern)
    if ($matchesFound.Count -ne 1) { throw "Extraction SQL ambigue : $pattern" }
    return $matchesFound[0].Value
}
function Run-Sql([string]$name,[string]$sql) {
    $local = Join-Path $runDir $name
    [IO.File]::WriteAllText($local,$sql,$utf8)
    Invoke-Docker -CommandArgs @('cp',$local,"${container}:/tmp/$name")
    Invoke-Docker -CommandArgs @('exec',$container,'psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d','captcf_facts_test','-f',"/tmp/$name")
}

try {
    # Explicit desktop-linux context, accepted only when backed by a local Windows pipe.
    $endpoint = & $docker context inspect desktop-linux --format '{{.Endpoints.docker.Host}}'
    if ($LASTEXITCODE -ne 0 -or $endpoint -notmatch '^npipe://') { throw 'Contexte Docker local Windows requis.' }
    Invoke-Docker -CommandArgs @('version')
    # Scope: isolated PostgreSQL tests, NOT a complete replay of the Supabase schema.
    # Auth helpers emulate Supabase JWT claims. Database roles and RLS are real.
    $initial = Read-Repo 'supabase/migrations/20260317202832_4faa0bcf-292f-49b4-b8a5-87b575e3912f.sql'
    $sources = Read-Repo 'supabase/migrations/20260709200000_pedagogical_sources_lot_a.sql'
    $families = Read-Repo 'supabase/migrations/20260727160100_differentiation_family_slice_foundations.sql'
    $schema = @'
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY,email text);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),
 nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid;
$$;
GRANT USAGE ON SCHEMA auth,public TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated,service_role;
'@
    foreach ($m in [regex]::Matches($initial,'(?m)^CREATE TYPE public\.[^;]+;')) { $schema += "`n" + $m.Value }
    foreach ($table in @('profiles','user_roles','epreuves','sous_sections','points_a_maitriser','sequences_pedagogiques','exercices')) {
        $schema += "`n" + (Extract-One $initial "(?ms)^CREATE TABLE public\.$table \(.*?^\);")
    }
    $schema += "`n" + (Extract-One $sources '(?ms)^CREATE TABLE IF NOT EXISTS public\.pedagogical_sources \(.*?^\);')
    $schema += "`n" + (Extract-One $families '(?ms)^CREATE TABLE IF NOT EXISTS public\.differentiation_families \(.*?^\);')
    $schema += @'

ALTER TABLE public.differentiation_families ADD COLUMN target_level text DEFAULT 'A2' CHECK(target_level IN ('A1','A2','B1','B2'));
ALTER TABLE public.pedagogical_sources ADD COLUMN content_hash text;
CREATE FUNCTION public.has_role(uid uuid,target_role public.app_role) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=uid AND role=target_role);
$$;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedagogical_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.differentiation_families ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.pedagogical_sources,public.differentiation_families TO authenticated,service_role;
CREATE FUNCTION public.touch_pedagogical_sources_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN NEW.updated_at=now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_sources_updated_at BEFORE UPDATE ON public.pedagogical_sources FOR EACH ROW EXECUTE FUNCTION public.touch_pedagogical_sources_updated_at();
CREATE TRIGGER trg_families_updated_at BEFORE UPDATE ON public.differentiation_families FOR EACH ROW EXECUTE FUNCTION public.touch_pedagogical_sources_updated_at();
'@
    foreach ($pair in @(@($sources,'pedagogical_sources'),@($families,'differentiation_families'))) {
        $policies = [regex]::Matches($pair[0],('(?s)CREATE POLICY "[^"]+"\s+ON public\.'+$pair[1]+'\s.*?;'))
        if ($policies.Count -ne 5) { throw "Nombre de policies inattendu : $($pair[1])" }
        foreach($policy in $policies) { $schema += "`n" + $policy.Value }
    }
    Write-Host 'Creation PostgreSQL local : aucun port publie, aucun dossier du PC monte.'
    # Pull is the only network use. Runtime container has networking disabled.
    Invoke-Docker -CommandArgs @('pull','postgres:17-bookworm')
    Invoke-Docker -CommandArgs @('run','--detach','--name',$container,'--label','captcf.facts-local=true','--network','none','--mount','type=tmpfs,destination=/var/lib/postgresql/data','--env','POSTGRES_HOST_AUTH_METHOD=trust','--env','POSTGRES_DB=captcf_facts_test','postgres:17-bookworm')
    $created = $true
    $ready=$false
    for($i=0;$i -lt 60;$i++) {
        & $docker --context desktop-linux exec $container pg_isready -U postgres -d captcf_facts_test *> $null
        if($LASTEXITCODE -eq 0){$ready=$true;break}
        Start-Sleep -Seconds 1
    }
    if(-not $ready){throw 'PostgreSQL local ne demarre pas.'}
    Invoke-Docker -CommandArgs @('image','inspect','postgres:17-bookworm','--format','{{.Id}} {{json .RepoDigests}}')
    Run-Sql '00-schema-test.sql' $schema
    Run-Sql '01-migration.sql' (Read-Repo 'supabase/migrations/20260930072021_revise_differentiation_facts_atomically.sql')
    Run-Sql '02-tests-roles.sql' (Read-Repo 'supabase/tests/facts_revision_local.sql')
    . (Join-Path $PSScriptRoot 'Test-CapTCF-Concurrency.ps1')
    Test-FactsConcurrency
    . (Join-Path $PSScriptRoot 'Test-CapTCF-GenerationRace.ps1')
    Test-FactsGenerationRace
    Run-Sql '03-rollback.sql' (Read-Repo 'supabase/secours/20260930072021_revise_differentiation_facts_rollback.sql')
    Run-Sql '04-check-rollback.sql' @'
DO $$ BEGIN
 IF to_regprocedure('public.revise_differentiation_facts_atomically(uuid,uuid,text,integer,timestamptz,jsonb)') IS NOT NULL THEN
 RAISE EXCEPTION 'ROLLBACK_INCOMPLETE'; END IF;
END $$;
'@
    $success = $true
    Write-Host 'PASS : migration, tests de roles/hash/atomicite et rollback sur schema cible isole.'
    Write-Host 'Concurrence multi-session testee. Reste a verifier : integration Supabase complete.'
} catch {
    ('ECHEC : ' + $_.Exception.Message) | Tee-Object -FilePath $log -Append | Write-Host
} finally {
    if($created) {
        # Only the uniquely named container created by this script is removed.
        & $docker --context desktop-linux rm --force $container 2>&1 | ForEach-Object { $_.ToString() } | Add-Content -LiteralPath $log
    }
    Write-Host "Rapport conserve : $log"
}
if(-not $success){exit 1}
