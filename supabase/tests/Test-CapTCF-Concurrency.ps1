function Test-FactsConcurrency {
    $spec = Read-Repo 'supabase/tests/facts_revision_concurrency.spec'
    $seed = [regex]::Match($spec,'(?s)setup\s*\{(.*?)\r?\n\}').Groups[1].Value
    $save = [regex]::Match($spec,'(?s)step "save1" \{ (.*?) \}').Groups[1].Value
    if (-not $seed -or -not $save) { throw 'Fixtures de concurrence introuvables.' }
    Run-Sql 'concurrency-seed.sql' $seed
    function Start-SqlSession([string]$label) {
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
        $proc.StandardInput.WriteLine("SET application_name='$label'; BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);")
        $proc.StandardInput.WriteLine("DO `$`$ BEGIN IF current_user <> 'authenticated' OR auth.uid() <> '10000000-0000-4000-8000-000000000001'::uuid THEN RAISE EXCEPTION 'WRONG_CONCURRENT_ACTOR'; END IF; END `$`$;")
        return @{ Process=$proc; Out=$outTask; Err=$errTask }
    }
    function Wait-SqlState([string]$condition) {
        $timer = [Diagnostics.Stopwatch]::StartNew()
        do {
            $seen = & $docker --context desktop-linux exec $container psql -X -At -U postgres -d captcf_facts_test -c "SELECT count(*) FROM pg_stat_activity WHERE $condition"
            if ($LASTEXITCODE -ne 0) { throw 'Observation concurrence impossible.' }
            if (($seen -join '').Trim() -eq '1') { return }
            Start-Sleep -Milliseconds 100
        } while ($timer.Elapsed.TotalSeconds -lt 3)
        throw "Concurrence non prouvee : $condition"
    }
    $sessions = @()
    try {
        $one = Start-SqlSession 'captcf_facts_one'; $sessions += $one
        $one.Process.StandardInput.WriteLine($save)
        Wait-SqlState "application_name='captcf_facts_one' AND state='idle in transaction' AND query LIKE 'SELECT public.revise%'"
        $two = Start-SqlSession 'captcf_facts_two'; $sessions += $two
        $two.Process.StandardInput.WriteLine($save)
        $two.Process.StandardInput.Close()
        Wait-SqlState "application_name='captcf_facts_two' AND wait_event_type='Lock'"
        $one.Process.StandardInput.WriteLine('COMMIT;')
        $one.Process.StandardInput.Close()
        foreach ($session in $sessions) {
            if (-not $session.Process.WaitForExit(15000)) { throw 'Session SQL bloquee.' }
            ($session.Out.Result + $session.Err.Result) | Tee-Object -FilePath $log -Append | Write-Host
        }
        if ($one.Process.ExitCode -ne 0) { throw 'La premiere sauvegarde a echoue.' }
        if ($two.Process.ExitCode -eq 0 -or $two.Err.Result -notmatch 'FACTS_REVISION_CONFLICT') { throw 'La sauvegarde concurrente obsolete doit etre refusee pour conflit.' }
        Run-Sql 'concurrency-check.sql' @'
DO $$ DECLARE f public.differentiation_families; BEGIN
 SELECT * INTO STRICT f FROM public.differentiation_families WHERE id='30000000-0000-4000-8000-000000000001';
 IF (f.payload->>'version')::int IS DISTINCT FROM 2 OR f.review_status IS DISTINCT FROM 'draft' THEN RAISE EXCEPTION 'CONCURRENCY_RESULT_INVALID'; END IF;
 IF f.payload#>>'{facts,required,0,object}' IS DISTINCT FROM 'revision' THEN RAISE EXCEPTION 'REVISION_NOT_SAVED'; END IF;
 IF EXISTS(SELECT 1 FROM public.pedagogical_sources WHERE id=f.source_id AND metadata ? 'studio_facts_confirmation') THEN RAISE EXCEPTION 'CONFIRMATION_NOT_INVALIDATED'; END IF;
END $$;
'@
        'PASS : deux connexions authenticated, attente du verrou observee, une seule revision, conflit obsolete refuse.' | Tee-Object -FilePath $log -Append | Write-Host
    } finally {
        foreach ($session in $sessions) {
            if (-not $session.Process.HasExited) { $session.Process.StandardInput.Close(); [void]$session.Process.WaitForExit(1000) }
            $session.Process.Dispose()
        }
    }
}
