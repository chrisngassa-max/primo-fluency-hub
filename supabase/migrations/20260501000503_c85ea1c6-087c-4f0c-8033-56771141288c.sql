-- RGPD P0 final: purge automatique des logs IA et audios > 12 mois
-- ai_processing_logs : suppression > 12 mois (rétention max documentée)
-- test-audio : suppression > 12 mois (proxy pédagogique, faute de date "fin de formation" structurée)

CREATE OR REPLACE FUNCTION public.purge_ai_processing_logs_older_than_12_months()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _deleted integer;
BEGIN
  DELETE FROM public.ai_processing_logs
  WHERE created_at < (now() - interval '12 months');
  GET DIAGNOSTICS _deleted = ROW_COUNT;
  RETURN _deleted;
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_test_audio_older_than_12_months()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  _deleted integer;
BEGIN
  DELETE FROM storage.objects
  WHERE bucket_id = 'test-audio'
    AND created_at < (now() - interval '12 months');
  GET DIAGNOSTICS _deleted = ROW_COUNT;
  RETURN _deleted;
END;
$$;

-- Renforcement RLS : verrouiller tout UPDATE/DELETE direct sur ai_processing_logs
-- (les politiques actuelles n'autorisent que SELECT/INSERT, on ajoute des deny explicites pour clarté)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ai_processing_logs' AND policyname = 'no update ai logs'
  ) THEN
    EXECUTE 'CREATE POLICY "no update ai logs" ON public.ai_processing_logs FOR UPDATE USING (false)';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ai_processing_logs' AND policyname = 'service role deletes ai logs'
  ) THEN
    EXECUTE 'CREATE POLICY "service role deletes ai logs" ON public.ai_processing_logs FOR DELETE USING (auth.role() = ''service_role'')';
  END IF;
END$$;