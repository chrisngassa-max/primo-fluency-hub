-- ============================================================
-- CapTCF — Vertical Slice CO A2
-- Fondations indépendantes du fournisseur STT :
-- intégrité de source, transcriptions, segments et provenance chunks.
-- ============================================================

BEGIN;

ALTER TABLE public.pedagogical_sources
  ADD COLUMN IF NOT EXISTS content_hash text;

ALTER TABLE public.pedagogical_sources
  DROP CONSTRAINT IF EXISTS pedagogical_sources_content_hash_check;

ALTER TABLE public.pedagogical_sources
  ADD CONSTRAINT pedagogical_sources_content_hash_check
  CHECK (
    content_hash IS NULL
    OR content_hash ~ '^sha256:[a-f0-9]{64}$'
  );

CREATE INDEX IF NOT EXISTS idx_pedagogical_sources_content_hash
  ON public.pedagogical_sources (content_hash)
  WHERE content_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.pedagogical_source_transcriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.pedagogical_sources(id) ON DELETE CASCADE,
  attempt_number integer NOT NULL DEFAULT 1 CHECK (attempt_number >= 1),
  is_current boolean NOT NULL DEFAULT true,
  provider text,
  model_id text,
  external_job_id text,
  language_detected text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'ready', 'reviewed', 'error')),
  raw_text text,
  reviewed_text text,
  average_confidence numeric
    CHECK (average_confidence IS NULL OR average_confidence BETWEEN 0 AND 1),
  provider_parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_details jsonb,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, attempt_number),
  CHECK (
    status <> 'reviewed'
    OR (
      reviewed_at IS NOT NULL
      AND reviewed_by IS NOT NULL
      AND coalesce(reviewed_text, raw_text) IS NOT NULL
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pedagogical_source_transcriptions_current
  ON public.pedagogical_source_transcriptions (source_id)
  WHERE is_current;

CREATE INDEX IF NOT EXISTS idx_pedagogical_source_transcriptions_source_status
  ON public.pedagogical_source_transcriptions (source_id, status, created_at DESC);

DROP TRIGGER IF EXISTS trg_pedagogical_source_transcriptions_updated_at
  ON public.pedagogical_source_transcriptions;
CREATE TRIGGER trg_pedagogical_source_transcriptions_updated_at
  BEFORE UPDATE ON public.pedagogical_source_transcriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_pedagogical_sources_updated_at();

CREATE TABLE IF NOT EXISTS public.pedagogical_source_transcription_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transcription_id uuid NOT NULL
    REFERENCES public.pedagogical_source_transcriptions(id) ON DELETE CASCADE,
  segment_key text NOT NULL,
  sequence_index integer NOT NULL CHECK (sequence_index >= 0),
  speaker_label text,
  start_ms integer NOT NULL CHECK (start_ms >= 0),
  end_ms integer NOT NULL,
  raw_text text NOT NULL,
  reviewed_text text,
  confidence numeric CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (transcription_id, segment_key),
  UNIQUE (transcription_id, sequence_index),
  CHECK (end_ms > start_ms)
);

CREATE INDEX IF NOT EXISTS idx_transcription_segments_timeline
  ON public.pedagogical_source_transcription_segments
  (transcription_id, sequence_index, start_ms);

DROP TRIGGER IF EXISTS trg_transcription_segments_updated_at
  ON public.pedagogical_source_transcription_segments;
CREATE TRIGGER trg_transcription_segments_updated_at
  BEFORE UPDATE ON public.pedagogical_source_transcription_segments
  FOR EACH ROW EXECUTE FUNCTION public.touch_pedagogical_sources_updated_at();

CREATE TABLE IF NOT EXISTS public.pedagogical_source_chunk_segments (
  chunk_id uuid NOT NULL
    REFERENCES public.pedagogical_source_chunks(id) ON DELETE CASCADE,
  segment_id uuid NOT NULL
    REFERENCES public.pedagogical_source_transcription_segments(id) ON DELETE CASCADE,
  relation_type text NOT NULL DEFAULT 'derived_from'
    CHECK (relation_type IN ('derived_from', 'summarizes', 'quotes', 'context')),
  sequence_index integer NOT NULL DEFAULT 0 CHECK (sequence_index >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chunk_id, segment_id),
  UNIQUE (chunk_id, sequence_index)
);

CREATE INDEX IF NOT EXISTS idx_pedagogical_source_chunk_segments_segment
  ON public.pedagogical_source_chunk_segments (segment_id, chunk_id);

CREATE OR REPLACE FUNCTION public.enforce_chunk_segment_same_source()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
DECLARE
  chunk_source_id uuid;
  segment_source_id uuid;
BEGIN
  SELECT source_id
    INTO chunk_source_id
    FROM public.pedagogical_source_chunks
    WHERE id = NEW.chunk_id;

  SELECT transcription.source_id
    INTO segment_source_id
    FROM public.pedagogical_source_transcription_segments AS segment
    JOIN public.pedagogical_source_transcriptions AS transcription
      ON transcription.id = segment.transcription_id
    WHERE segment.id = NEW.segment_id;

  IF chunk_source_id IS NULL OR segment_source_id IS NULL OR chunk_source_id <> segment_source_id THEN
    RAISE EXCEPTION 'Chunk and transcription segment must belong to the same pedagogical source';
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_chunk_segment_same_source
  ON public.pedagogical_source_chunk_segments;
CREATE TRIGGER trg_chunk_segment_same_source
  BEFORE INSERT OR UPDATE ON public.pedagogical_source_chunk_segments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_chunk_segment_same_source();

ALTER TABLE public.pedagogical_source_transcriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedagogical_source_transcription_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedagogical_source_chunk_segments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_read_pedagogical_source_transcriptions"
  ON public.pedagogical_source_transcriptions;
CREATE POLICY "staff_read_pedagogical_source_transcriptions"
  ON public.pedagogical_source_transcriptions FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'formateur'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "staff_write_own_pedagogical_source_transcriptions"
  ON public.pedagogical_source_transcriptions;
CREATE POLICY "staff_write_own_pedagogical_source_transcriptions"
  ON public.pedagogical_source_transcriptions FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.pedagogical_sources AS source
      WHERE source.id = source_id
        AND (
          source.created_by = auth.uid()
          OR public.has_role(auth.uid(), 'admin'::public.app_role)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.pedagogical_sources AS source
      WHERE source.id = source_id
        AND (
          source.created_by = auth.uid()
          OR public.has_role(auth.uid(), 'admin'::public.app_role)
        )
    )
  );

DROP POLICY IF EXISTS "service_all_pedagogical_source_transcriptions"
  ON public.pedagogical_source_transcriptions;
CREATE POLICY "service_all_pedagogical_source_transcriptions"
  ON public.pedagogical_source_transcriptions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "staff_read_transcription_segments"
  ON public.pedagogical_source_transcription_segments;
CREATE POLICY "staff_read_transcription_segments"
  ON public.pedagogical_source_transcription_segments FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'formateur'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "staff_write_own_transcription_segments"
  ON public.pedagogical_source_transcription_segments;
CREATE POLICY "staff_write_own_transcription_segments"
  ON public.pedagogical_source_transcription_segments FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.pedagogical_source_transcriptions AS transcription
      JOIN public.pedagogical_sources AS source ON source.id = transcription.source_id
      WHERE transcription.id = transcription_id
        AND (
          source.created_by = auth.uid()
          OR public.has_role(auth.uid(), 'admin'::public.app_role)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.pedagogical_source_transcriptions AS transcription
      JOIN public.pedagogical_sources AS source ON source.id = transcription.source_id
      WHERE transcription.id = transcription_id
        AND (
          source.created_by = auth.uid()
          OR public.has_role(auth.uid(), 'admin'::public.app_role)
        )
    )
  );

DROP POLICY IF EXISTS "service_all_transcription_segments"
  ON public.pedagogical_source_transcription_segments;
CREATE POLICY "service_all_transcription_segments"
  ON public.pedagogical_source_transcription_segments FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "staff_read_chunk_segments"
  ON public.pedagogical_source_chunk_segments;
CREATE POLICY "staff_read_chunk_segments"
  ON public.pedagogical_source_chunk_segments FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'formateur'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "staff_write_own_chunk_segments"
  ON public.pedagogical_source_chunk_segments;
CREATE POLICY "staff_write_own_chunk_segments"
  ON public.pedagogical_source_chunk_segments FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.pedagogical_source_chunks AS chunk
      JOIN public.pedagogical_sources AS source ON source.id = chunk.source_id
      WHERE chunk.id = chunk_id
        AND (
          source.created_by = auth.uid()
          OR public.has_role(auth.uid(), 'admin'::public.app_role)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.pedagogical_source_chunks AS chunk
      JOIN public.pedagogical_sources AS source ON source.id = chunk.source_id
      WHERE chunk.id = chunk_id
        AND (
          source.created_by = auth.uid()
          OR public.has_role(auth.uid(), 'admin'::public.app_role)
        )
    )
  );

DROP POLICY IF EXISTS "service_all_chunk_segments"
  ON public.pedagogical_source_chunk_segments;
CREATE POLICY "service_all_chunk_segments"
  ON public.pedagogical_source_chunk_segments FOR ALL TO service_role
  USING (true) WITH CHECK (true);

COMMIT;
