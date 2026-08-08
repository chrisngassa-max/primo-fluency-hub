ALTER FUNCTION public.validate_pedagogical_source_transcription_review(uuid, text, jsonb)
  SECURITY DEFINER;
ALTER FUNCTION public.validate_pedagogical_source_transcription_review(uuid, text, jsonb)
  SET search_path TO public;
REVOKE ALL
  ON FUNCTION public.validate_pedagogical_source_transcription_review(uuid, text, jsonb)
  FROM PUBLIC;
REVOKE ALL
  ON FUNCTION public.validate_pedagogical_source_transcription_review(uuid, text, jsonb)
  FROM anon;
GRANT EXECUTE
  ON FUNCTION public.validate_pedagogical_source_transcription_review(uuid, text, jsonb)
  TO authenticated, service_role;;
