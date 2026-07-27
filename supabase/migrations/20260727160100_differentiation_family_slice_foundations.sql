-- ============================================================
-- CapTCF — Vertical Slice CO A2
-- Persistance des familles partielles et feedback formateur.
-- Aucun mécanisme de révision ou de fusion dans cette migration.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.differentiation_families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL
    REFERENCES public.pedagogical_sources(id) ON DELETE CASCADE,
  family_id text NOT NULL UNIQUE
    CHECK (family_id ~ '^[A-Z0-9][A-Z0-9_-]{5,79}$'),
  competence text NOT NULL DEFAULT 'CO'
    CHECK (competence IN ('CO', 'CE', 'EE', 'EO', 'Structures')),
  schema_version text NOT NULL DEFAULT 'slice-1.0',
  referential_version text NOT NULL,
  source_content_hash text NOT NULL
    CHECK (source_content_hash ~ '^sha256:[a-f0-9]{64}$'),
  generation_status text NOT NULL DEFAULT 'queued'
    CHECK (generation_status IN ('queued', 'generating', 'generated', 'failed')),
  validation_status text NOT NULL DEFAULT 'pending'
    CHECK (validation_status IN ('pending', 'passed', 'passed_with_warnings', 'failed')),
  review_status text NOT NULL DEFAULT 'draft'
    CHECK (review_status IN ('draft', 'in_review', 'validated', 'rejected', 'published', 'archived')),
  generation_error jsonb,
  validation_report jsonb NOT NULL DEFAULT '{
    "status": "not_run",
    "blocking": [],
    "warnings": [],
    "requires_human_review": []
  }'::jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  generation_started_at timestamptz,
  generation_completed_at timestamptz,
  published_exercise_id uuid REFERENCES public.exercices(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    review_status <> 'published'
    OR (
      validation_status IN ('passed', 'passed_with_warnings')
      AND published_exercise_id IS NOT NULL
    )
  ),
  CHECK (
    generation_status <> 'generated'
    OR generation_completed_at IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_differentiation_families_source
  ON public.differentiation_families
  (source_id, competence, review_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_differentiation_families_generation
  ON public.differentiation_families
  (generation_status, validation_status, updated_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_differentiation_families_published_exercise
  ON public.differentiation_families (published_exercise_id)
  WHERE published_exercise_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_differentiation_families_updated_at
  ON public.differentiation_families;
CREATE TRIGGER trg_differentiation_families_updated_at
  BEFORE UPDATE ON public.differentiation_families
  FOR EACH ROW EXECUTE FUNCTION public.touch_pedagogical_sources_updated_at();

CREATE TABLE IF NOT EXISTS public.differentiation_family_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL
    REFERENCES public.differentiation_families(id) ON DELETE CASCADE,
  target_type text NOT NULL
    CHECK (target_type IN (
      'family',
      'fact',
      'level_contract',
      'variant',
      'item',
      'distractor',
      'justification',
      'source_ref'
    )),
  target_id text,
  issue_type text NOT NULL
    CHECK (issue_type IN (
      'incorrect',
      'ambiguous',
      'too_easy',
      'too_difficult',
      'language_level',
      'missing_information',
      'bad_distractor',
      'wrong_answer',
      'wrong_timestamp',
      'poor_wording',
      'other'
    )),
  comment text NOT NULL CHECK (length(trim(comment)) >= 3),
  suggested_value jsonb,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CHECK (
    target_type = 'family'
    OR target_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_differentiation_family_feedback_target
  ON public.differentiation_family_feedback
  (family_id, target_type, target_id, created_at);

CREATE INDEX IF NOT EXISTS idx_differentiation_family_feedback_open
  ON public.differentiation_family_feedback
  (family_id, created_at)
  WHERE resolved_at IS NULL;

ALTER TABLE public.differentiation_families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.differentiation_family_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_read_differentiation_families"
  ON public.differentiation_families;
CREATE POLICY "staff_read_differentiation_families"
  ON public.differentiation_families FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'formateur'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "staff_insert_own_differentiation_families"
  ON public.differentiation_families;
CREATE POLICY "staff_insert_own_differentiation_families"
  ON public.differentiation_families FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.pedagogical_sources AS source
      WHERE source.id = source_id
        AND (
          source.created_by = auth.uid()
          OR public.has_role(auth.uid(), 'admin'::public.app_role)
        )
    )
  );

DROP POLICY IF EXISTS "staff_update_own_differentiation_families"
  ON public.differentiation_families;
CREATE POLICY "staff_update_own_differentiation_families"
  ON public.differentiation_families FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  WITH CHECK (
    created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "staff_delete_own_differentiation_families"
  ON public.differentiation_families;
CREATE POLICY "staff_delete_own_differentiation_families"
  ON public.differentiation_families FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "service_all_differentiation_families"
  ON public.differentiation_families;
CREATE POLICY "service_all_differentiation_families"
  ON public.differentiation_families FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "staff_read_differentiation_family_feedback"
  ON public.differentiation_family_feedback;
CREATE POLICY "staff_read_differentiation_family_feedback"
  ON public.differentiation_family_feedback FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'formateur'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "staff_insert_own_differentiation_family_feedback"
  ON public.differentiation_family_feedback;
CREATE POLICY "staff_insert_own_differentiation_family_feedback"
  ON public.differentiation_family_feedback FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.differentiation_families AS family
      WHERE family.id = family_id
        AND (
          family.created_by = auth.uid()
          OR public.has_role(auth.uid(), 'admin'::public.app_role)
        )
    )
  );

DROP POLICY IF EXISTS "staff_update_own_differentiation_family_feedback"
  ON public.differentiation_family_feedback;
CREATE POLICY "staff_update_own_differentiation_family_feedback"
  ON public.differentiation_family_feedback FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  WITH CHECK (
    created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "service_all_differentiation_family_feedback"
  ON public.differentiation_family_feedback;
CREATE POLICY "service_all_differentiation_family_feedback"
  ON public.differentiation_family_feedback FOR ALL TO service_role
  USING (true) WITH CHECK (true);

COMMIT;
