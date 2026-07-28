-- Follow-up: SECURITY DEFINER + search_path + privileges restreints
-- pour validate_pedagogical_source_transcription_review.
-- Necessaire car 20260728113000 a deja ete appliquee avant le hardening
-- SECURITY DEFINER du commit d71c20f ; modifier le fichier initial ne
-- suffit pas pour les bases deja migrees.

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
  TO authenticated, service_role;
