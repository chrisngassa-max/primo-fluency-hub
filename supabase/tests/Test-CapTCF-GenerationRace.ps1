# Loaded by Test-CapTCF-Facts.ps1; synthetic data in its disposable local container.
function Test-FactsGenerationRace {
    $spec = Read-Repo 'supabase/tests/facts_revision_concurrency.spec'
    $seed = [regex]::Match($spec,'(?s)setup\s*\{(.*?)\r?\n\}').Groups[1].Value
    $seed = $seed.Substring($seed.IndexOf('INSERT INTO public.pedagogical_sources'))
    $save = [regex]::Match($spec,'(?s)step "save1" \{ (.*?) \}').Groups[1].Value
    $generate = @'
INSERT INTO public.differentiation_families(id,source_id,family_id,created_by,target_level,referential_version,source_content_hash,generation_status,payload)
VALUES('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','LOCAL-GENERATION','10000000-0000-4000-8000-000000000001','B1','co-a2-1.2','sha256:'||repeat('a',64),'generating','{}');
'@
    $confirm = @'
UPDATE public.pedagogical_sources SET metadata=jsonb_build_object('studio_facts_confirmation',jsonb_build_object('facts_hash','sha256:0613abe1727a710cdccb212acff28301b26ece9ffead7605ef6c4cea359881f4','confirmed_by',auth.uid())) WHERE id='20000000-0000-4000-8000-000000000001';
'@
    function Start-RaceSession([string]$label,[string]$role) {
        $info = New-Object System.Diagnostics.ProcessStartInfo
        $info.FileName = $docker
        $info.Arguments = "--context desktop-linux exec -i $container psql -X -q -v ON_ERROR_STOP=1 -U postgres -d captcf_facts_test"
        $info.UseShellExecute = $false
        $info.CreateNoWindow = $true
        $info.RedirectStandardInput = $true
        $info.RedirectStandardOutput = $true
        $info.RedirectStandardError = $true
        $proc = New-Object System.Diagnostics.Process
        $proc.StartInfo = $info
        [void]$proc.Start()
        $outTask = $proc.StandardOutput.ReadToEndAsync()
        $errTask = $proc.StandardError.ReadToEndAsync()
        $proc.StandardInput.WriteLine("SET application_name='$label'; BEGIN; SET LOCAL ROLE $role; SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);")
        return @{ Process=$proc; Out=$outTask; Err=$errTask }
    }
    function Wait-RaceState([string]$condition) {
        $timer = [Diagnostics.Stopwatch]::StartNew()
        do {
            $seen = & $docker --context desktop-linux exec $container psql -X -At -U postgres -d captcf_facts_test -c "SELECT count(*) FROM pg_stat_activity WHERE $condition"
            if ($LASTEXITCODE -ne 0) { throw 'Observation concurrence impossible.' }
            if (($seen -join '').Trim() -eq '1') { return }
            Start-Sleep -Milliseconds 100
        } while ($timer.Elapsed.TotalSeconds -lt 3)
        throw "Concurrence non prouvee : $condition"
    }
    $cases = @(
        @{ Name='revision_then_generation'; First=$save; FirstRole='authenticated'; Second=$generate; SecondRole='service_role'; Error='FACTS_CONFIRMATION_REQUIRED' },
        @{ Name='generation_then_revision'; First=$generate; FirstRole='service_role'; Second=$save; SecondRole='authenticated'; Error='FACTS_ALREADY_REUSED' },
        @{ Name='revision_then_confirmation'; First=$save; FirstRole='authenticated'; Second=$confirm; SecondRole='authenticated'; Error='FACTS_CONFIRMATION_CONFLICT' },
        @{ Name='confirmation_then_revision'; First=$confirm; FirstRole='authenticated'; Second=$save; SecondRole='authenticated'; Error='FACTS_REVISION_CONFLICT' }
    )
    foreach($case in $cases) {
        Run-Sql 'race-seed.sql' ("DELETE FROM public.differentiation_families; DELETE FROM public.pedagogical_sources;`n"+$seed)
        $sessions=@()
        try {
            $one=Start-RaceSession 'captcf_race_one' $case.FirstRole; $sessions+=$one
            $one.Process.StandardInput.WriteLine($case.First)
            Wait-RaceState "application_name='captcf_race_one' AND state='idle in transaction' AND (query LIKE 'SELECT public.revise%' OR query LIKE 'INSERT INTO public.differentiation%' OR query LIKE 'UPDATE public.pedagogical%')"
            $two=Start-RaceSession 'captcf_race_two' $case.SecondRole; $sessions+=$two
            $two.Process.StandardInput.WriteLine($case.Second)
            $two.Process.StandardInput.Close()
            Wait-RaceState "application_name='captcf_race_two' AND wait_event_type='Lock'"
            $one.Process.StandardInput.WriteLine('COMMIT;'); $one.Process.StandardInput.Close()
            foreach($session in $sessions) {
                if(-not $session.Process.WaitForExit(15000)) { throw 'Session SQL bloquee.' }
                ($session.Out.Result+$session.Err.Result) | Tee-Object -FilePath $log -Append | Write-Host
            }
            if($one.Process.ExitCode -ne 0) { throw "Premiere operation echouee : $($case.Name)" }
            if($two.Process.ExitCode -eq 0 -or $two.Err.Result -notmatch $case.Error) { throw "Refus attendu absent : $($case.Name) / $($case.Error)" }
            "PASS : $($case.Name), attente observee, refus $($case.Error)." | Tee-Object -FilePath $log -Append | Write-Host
        } finally {
            foreach($session in $sessions) {
                if(-not $session.Process.HasExited) { $session.Process.StandardInput.Close(); [void]$session.Process.WaitForExit(1000) }
                $session.Process.Dispose()
            }
        }
    }
}
