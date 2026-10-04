-- Local only: no source data/backfill, no table grants or RLS changes.
BEGIN;

CREATE FUNCTION public.guard_pedagogical_source_review_status()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog
AS $fn$
BEGIN
  -- current_user is the effective SQL role, NOT a JWT claim or custom GUC.
  -- PostgREST authenticated/anon cannot SET ROLE postgres/service_role.
  -- Keep trusted administrative jobs and existing postgres-owned review RPCs.
  IF current_user IN ('postgres', 'service_role') THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.review_status IS DISTINCT FROM 'brouillon' THEN
      RAISE EXCEPTION 'SOURCE_REVIEW_DIRECT_WRITE_FORBIDDEN' USING ERRCODE = '42501';
    END IF;
  ELSIF NEW.review_status IS DISTINCT FROM OLD.review_status THEN
    RAISE EXCEPTION 'SOURCE_REVIEW_DIRECT_WRITE_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$fn$;
ALTER FUNCTION public.guard_pedagogical_source_review_status() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.guard_pedagogical_source_review_status() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER guard_pedagogical_source_review_status
BEFORE INSERT OR UPDATE OF review_status ON public.pedagogical_sources
FOR EACH ROW EXECUTE FUNCTION public.guard_pedagogical_source_review_status();

CREATE FUNCTION public.mark_pedagogical_source_usable(
  p_source_id uuid,
  p_confirmed boolean,
  p_expected_updated_at timestamptz
)
RETURNS TABLE(source_id uuid, review_status text, updated_at timestamptz, changed boolean)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
SET lock_timeout = '5s'
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_admin boolean;
  v_source public.pedagogical_sources%ROWTYPE;
  v_transcription public.pedagogical_source_transcriptions%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501'; END IF;
  v_admin := coalesce(public.has_role(v_uid, 'admin'::public.app_role), false);
  IF NOT v_admin AND NOT coalesce(public.has_role(v_uid, 'formateur'::public.app_role), false) THEN
    RAISE EXCEPTION 'STAFF_ROLE_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_confirmed IS DISTINCT FROM true THEN RAISE EXCEPTION 'SOURCE_REVIEW_CONFIRMATION_REQUIRED'; END IF;

  SELECT s.* INTO v_source FROM public.pedagogical_sources AS s WHERE s.id=p_source_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SOURCE_NOT_FOUND'; END IF;
  IF NOT v_admin AND v_source.created_by IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'SOURCE_FORBIDDEN' USING ERRCODE='42501';
  END IF;
  IF v_source.review_status NOT IN ('brouillon','utilisable') THEN RAISE EXCEPTION 'SOURCE_REVIEW_INVALID_STATE'; END IF;
  IF v_source.source_kind <> 'audio' THEN RAISE EXCEPTION 'SOURCE_NOT_AUDIO'; END IF;
  IF v_source.content_hash IS NULL OR v_source.content_hash !~ '^sha256:[a-f0-9]{64}$' THEN RAISE EXCEPTION 'SOURCE_HASH_REQUIRED'; END IF;
  IF coalesce(btrim(v_source.storage_path),'')='' OR coalesce(btrim(v_source.storage_bucket),'')='' THEN RAISE EXCEPTION 'SOURCE_MP3_MISSING'; END IF;
  -- Rights are free text in the existing schema; do not invent an enum.
  -- Explicit AI reuse permission plus nonempty rights are required for this action.
  IF coalesce(btrim(v_source.rights_status),'')='' OR v_source.reusable_for_ai IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'SOURCE_RIGHTS_REQUIRED';
  END IF;
  SELECT t.* INTO v_transcription FROM public.pedagogical_source_transcriptions AS t
    WHERE t.source_id=p_source_id AND t.is_current FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TRANSCRIPTION_NOT_FOUND'; END IF;
  IF v_transcription.status <> 'reviewed' OR coalesce(btrim(v_transcription.reviewed_text),'')=''
     OR v_transcription.reviewed_at IS NULL OR v_transcription.reviewed_by IS NULL THEN
    RAISE EXCEPTION 'REVIEWED_TRANSCRIPTION_REQUIRED';
  END IF;
  IF v_source.status <> 'analyzed' OR NOT EXISTS (
    SELECT 1 FROM public.pedagogical_source_chunks AS c WHERE c.source_id=p_source_id
  ) THEN RAISE EXCEPTION 'SOURCE_NOT_ANALYZED'; END IF;
  -- Re-reading is idempotent only while the source still satisfies prerequisites.
  IF v_source.review_status='utilisable' THEN
    RETURN QUERY SELECT v_source.id, v_source.review_status, v_source.updated_at, false;
    RETURN;
  END IF;
  IF p_expected_updated_at IS NULL OR v_source.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'SOURCE_REVIEW_CONFLICT' USING ERRCODE='40001';
  END IF;
  UPDATE public.pedagogical_sources AS s SET review_status='utilisable' WHERE s.id=p_source_id
    RETURNING s.* INTO v_source;
  RETURN QUERY SELECT v_source.id, v_source.review_status, v_source.updated_at, true;
EXCEPTION WHEN lock_not_available OR deadlock_detected THEN
  RAISE EXCEPTION 'SOURCE_REVIEW_CONFLICT' USING ERRCODE='40001';
END;
$fn$;
ALTER FUNCTION public.mark_pedagogical_source_usable(uuid,boolean,timestamptz) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.mark_pedagogical_source_usable(uuid,boolean,timestamptz) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_pedagogical_source_usable(uuid,boolean,timestamptz) TO authenticated;
COMMENT ON FUNCTION public.mark_pedagogical_source_usable(uuid,boolean,timestamptz)
IS 'Explicit owner/staff source review; only brouillon to utilisable. Does not publish or generate exercises.';
COMMIT;
