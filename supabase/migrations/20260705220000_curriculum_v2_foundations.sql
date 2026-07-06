-- ============================================================
-- CapTCF — Curriculum v2 foundations (Plan maître S1-S37 + E1-E4)
-- Lot 1 : structures de donnees additives, sans impact sur les
-- tables et parcours existants (pedagogical_images, groups, ...).
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- Statuts partages par les ressources du pipeline (section 8.2)
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'curriculum_resource_status') THEN
    CREATE TYPE public.curriculum_resource_status AS ENUM (
      'planned',
      'preflight_passed',
      'generating',
      'generated',
      'deterministic_checked',
      'ai_reviewed',
      'publishable',
      'published',
      'quarantined',
      'superseded',
      'unpublished'
    );
  END IF;
END $$;

-- ------------------------------------------------------------
-- training_plan_versions
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.training_plan_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL UNIQUE,
  statut text NOT NULL DEFAULT 'draft' CHECK (statut IN ('draft', 'active', 'archived')),
  heures_a2 numeric(6, 2) NOT NULL DEFAULT 80,
  heures_b1 numeric(6, 2) NOT NULL DEFAULT 100,
  heures_b2 numeric(6, 2) NOT NULL DEFAULT 120,
  paliers jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text NOT NULL DEFAULT '',
  activated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- training_sessions (S01-S37, E1-E4)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.training_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_version_id uuid NOT NULL REFERENCES public.training_plan_versions(id) ON DELETE CASCADE,
  code text NOT NULL CHECK (code ~ '^(S[0-3][0-9]|E[1-4])$'),
  ordre integer NOT NULL,
  kind text NOT NULL DEFAULT 'session' CHECK (kind IN ('session', 'evaluation')),
  module text CHECK (module IS NULL OR module IN ('A', 'B', 'C', 'D', 'E', 'F', 'G')),
  palier text NOT NULL CHECK (palier IN ('A2', 'B1', 'B2')),
  type_seance text NOT NULL,
  duree_minutes integer NOT NULL CHECK (duree_minutes > 0),
  titre text NOT NULL,
  objectifs jsonb NOT NULL DEFAULT '[]'::jsonb,
  competences text[] NOT NULL DEFAULT '{}',
  civic_theme text,
  civic_mention text CHECK (civic_mention IS NULL OR civic_mention IN ('CSP', 'CR', 'NAT')),
  support_id text,
  source_ids text[] NOT NULL DEFAULT '{}',
  statut public.curriculum_resource_status NOT NULL DEFAULT 'planned',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_version_id, code)
);

CREATE INDEX IF NOT EXISTS idx_training_sessions_plan_ordre
  ON public.training_sessions (plan_version_id, ordre);

CREATE INDEX IF NOT EXISTS idx_training_sessions_palier
  ON public.training_sessions (palier);

-- ------------------------------------------------------------
-- invariant_supports (support-master partage par A1/A2/B1/B2)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invariant_supports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  support_id text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  hash text NOT NULL,
  session_id uuid REFERENCES public.training_sessions(id) ON DELETE SET NULL,
  session_code text,
  donnees_canoniques jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_ids text[] NOT NULL DEFAULT '{}',
  statut public.curriculum_resource_status NOT NULL DEFAULT 'planned',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (support_id, version)
);

CREATE INDEX IF NOT EXISTS idx_invariant_supports_session
  ON public.invariant_supports (session_code);

-- ------------------------------------------------------------
-- session_resources (fichiers du paquet obligatoire par seance)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.session_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.training_sessions(id) ON DELETE CASCADE,
  support_id uuid REFERENCES public.invariant_supports(id) ON DELETE SET NULL,
  resource_id text NOT NULL,
  kind text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  chemin text,
  mime text,
  hash text,
  provider text,
  generation_mode text CHECK (
    generation_mode IS NULL OR generation_mode IN (
      'deterministic', 'ai_generated', 'template', 'reused', 'tts', 'raster_provider'
    )
  ),
  statut public.curriculum_resource_status NOT NULL DEFAULT 'planned',
  published_at timestamptz,
  published_by text,
  previous_resource_version_id uuid REFERENCES public.session_resources(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, resource_id, version)
);

CREATE INDEX IF NOT EXISTS idx_session_resources_session
  ON public.session_resources (session_id);

CREATE INDEX IF NOT EXISTS idx_session_resources_statut
  ON public.session_resources (statut);

-- ------------------------------------------------------------
-- exercise_variants (A1/A2/B1/B2 derives d'un support invariant)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.exercise_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  support_id uuid NOT NULL REFERENCES public.invariant_supports(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  niveau text NOT NULL CHECK (niveau IN ('A1', 'A2', 'B1', 'B2')),
  consigne text NOT NULL DEFAULT '',
  aides jsonb NOT NULL DEFAULT '[]'::jsonb,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  corrige jsonb NOT NULL DEFAULT '{}'::jsonb,
  invariants_hash text NOT NULL,
  statut public.curriculum_resource_status NOT NULL DEFAULT 'planned',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (support_id, niveau, version)
);

CREATE INDEX IF NOT EXISTS idx_exercise_variants_support
  ON public.exercise_variants (support_id);

-- ------------------------------------------------------------
-- civic_questions (banque CSP/CR/NAT, jamais officielle sans source)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.civic_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mention text NOT NULL CHECK (mention IN ('CSP', 'CR', 'NAT')),
  theme text NOT NULL,
  notion text NOT NULL DEFAULT '',
  type text NOT NULL CHECK (type IN ('connaissance', 'mise_en_situation')),
  official_status text NOT NULL DEFAULT 'simulation_pedagogique'
    CHECK (official_status IN ('officielle', 'simulation_pedagogique')),
  source_id text,
  referential_version text,
  enonce text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  corrige jsonb NOT NULL DEFAULT '{}'::jsonb,
  statut public.curriculum_resource_status NOT NULL DEFAULT 'planned',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT civic_questions_official_requires_source
    CHECK (official_status <> 'officielle' OR source_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_civic_questions_mention_theme
  ON public.civic_questions (mention, theme);

-- ------------------------------------------------------------
-- resource_generation_batches (un seul batch orchestrateur)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.resource_generation_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_version_id uuid NOT NULL REFERENCES public.training_plan_versions(id) ON DELETE CASCADE,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  cout_estime_eur numeric(10, 4),
  cout_reel_eur numeric(10, 4),
  etat text NOT NULL DEFAULT 'pending' CHECK (etat IN (
    'pending', 'preflight_failed', 'running', 'paused',
    'published_complete', 'published_partial', 'needs_attention', 'failed'
  )),
  compteurs jsonb NOT NULL DEFAULT '{}'::jsonb,
  rapport jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resource_generation_batches_plan
  ON public.resource_generation_batches (plan_version_id, created_at DESC);

-- ------------------------------------------------------------
-- resource_generation_jobs (sous-jobs persistes et reprenables)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.resource_generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.resource_generation_batches(id) ON DELETE CASCADE,
  session_code text NOT NULL,
  resource_id text NOT NULL,
  tentative integer NOT NULL DEFAULT 0,
  depends_on text[] NOT NULL DEFAULT '{}',
  statut text NOT NULL DEFAULT 'queued' CHECK (statut IN (
    'queued', 'running', 'succeeded', 'failed', 'retrying', 'quarantined'
  )),
  erreurs jsonb NOT NULL DEFAULT '[]'::jsonb,
  idempotency_key text NOT NULL UNIQUE,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resource_generation_jobs_batch
  ON public.resource_generation_jobs (batch_id, statut);

CREATE INDEX IF NOT EXISTS idx_resource_generation_jobs_session
  ON public.resource_generation_jobs (session_code, resource_id);

-- ------------------------------------------------------------
-- validation_reports (controle 1 deterministe + controle 2 IA)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.validation_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_resource_id uuid REFERENCES public.session_resources(id) ON DELETE CASCADE,
  exercise_variant_id uuid REFERENCES public.exercise_variants(id) ON DELETE CASCADE,
  civic_question_id uuid REFERENCES public.civic_questions(id) ON DELETE CASCADE,
  validateur text NOT NULL CHECK (validateur IN ('deterministic', 'ai_review')),
  modele text,
  regles jsonb NOT NULL DEFAULT '[]'::jsonb,
  scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  bloquants jsonb NOT NULL DEFAULT '[]'::jsonb,
  rapport jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT validation_reports_target_present CHECK (
    session_resource_id IS NOT NULL OR exercise_variant_id IS NOT NULL OR civic_question_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_validation_reports_resource
  ON public.validation_reports (session_resource_id);

-- ------------------------------------------------------------
-- exercise_image_assets (image par question, jamais reponse-revelatrice)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.exercise_image_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_variant_id uuid NOT NULL REFERENCES public.exercise_variants(id) ON DELETE CASCADE,
  session_resource_id uuid REFERENCES public.session_resources(id) ON DELETE SET NULL,
  question_index integer NOT NULL DEFAULT 0,
  role text NOT NULL DEFAULT 'illustration',
  ordre integer NOT NULL DEFAULT 0,
  depends_on_answer boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1,
  hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exercise_variant_id, question_index, ordre, version)
);

CREATE INDEX IF NOT EXISTS idx_exercise_image_assets_variant
  ON public.exercise_image_assets (exercise_variant_id);

-- ------------------------------------------------------------
-- curriculum_publications (historique atomique des publications)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.curriculum_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_version_id uuid NOT NULL REFERENCES public.training_plan_versions(id) ON DELETE CASCADE,
  session_resource_id uuid NOT NULL REFERENCES public.session_resources(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  published_at timestamptz NOT NULL DEFAULT now(),
  published_by text NOT NULL DEFAULT 'automation',
  previous_publication_id uuid REFERENCES public.curriculum_publications(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_curriculum_publications_resource
  ON public.curriculum_publications (session_resource_id, published_at DESC);

-- ------------------------------------------------------------
-- cohort_resource_pins (une cohorte reste sur sa version)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cohort_resource_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  plan_version_id uuid NOT NULL REFERENCES public.training_plan_versions(id) ON DELETE CASCADE,
  support_id uuid REFERENCES public.invariant_supports(id) ON DELETE SET NULL,
  session_resource_id uuid REFERENCES public.session_resources(id) ON DELETE SET NULL,
  pinned_version integer NOT NULL DEFAULT 1,
  pinned_at timestamptz NOT NULL DEFAULT now(),
  pinned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT cohort_resource_pins_target_present CHECK (
    support_id IS NOT NULL OR session_resource_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_cohort_resource_pins_cohort
  ON public.cohort_resource_pins (cohort_id);

-- ------------------------------------------------------------
-- pedagogical_images : ajout des champs de publication/tracabilite
-- (reste la seule banque de fichiers image, pas de doublon)
-- ------------------------------------------------------------
ALTER TABLE public.pedagogical_images
  ADD COLUMN IF NOT EXISTS session_resource_id uuid REFERENCES public.session_resources(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS support_id text,
  ADD COLUMN IF NOT EXISTS session_code text,
  ADD COLUMN IF NOT EXISTS resource_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS previous_version_id uuid REFERENCES public.pedagogical_images(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_by text,
  ADD COLUMN IF NOT EXISTS generation_provider text,
  ADD COLUMN IF NOT EXISTS generation_model text,
  ADD COLUMN IF NOT EXISTS fallback_svg_path text;

CREATE INDEX IF NOT EXISTS idx_pedagogical_images_session_code
  ON public.pedagogical_images (session_code);

-- ------------------------------------------------------------
-- updated_at triggers (reutilise la fonction generique existante
-- si disponible, sinon en cree une locale au schema curriculum)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_curriculum_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'training_plan_versions',
    'training_sessions',
    'invariant_supports',
    'session_resources',
    'exercise_variants',
    'civic_questions',
    'resource_generation_batches',
    'resource_generation_jobs'
  ]
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%I_updated_at ON public.%I;',
      t, t
    );
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.touch_curriculum_updated_at();',
      t, t
    );
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- RLS : lecture formateur/admin, ecriture service_role uniquement.
-- Les tables de contenu publie (sessions, ressources, variantes,
-- questions civiques) restent lisibles par les apprenants une fois
-- publiees ; le reste du pipeline (jobs, batches, rapports, pins)
-- est reserve au formateur/admin et au service_role.
-- ------------------------------------------------------------
ALTER TABLE public.training_plan_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invariant_supports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.civic_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_generation_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.validation_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_image_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculum_publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cohort_resource_pins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "curriculum_staff_read_plan_versions" ON public.training_plan_versions;
CREATE POLICY "curriculum_staff_read_plan_versions"
  ON public.training_plan_versions FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'formateur'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "curriculum_service_all_plan_versions" ON public.training_plan_versions;
CREATE POLICY "curriculum_service_all_plan_versions"
  ON public.training_plan_versions FOR ALL TO service_role
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "curriculum_staff_read_sessions" ON public.training_sessions;
CREATE POLICY "curriculum_staff_read_sessions"
  ON public.training_sessions FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'formateur'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "curriculum_students_read_published_sessions" ON public.training_sessions;
CREATE POLICY "curriculum_students_read_published_sessions"
  ON public.training_sessions FOR SELECT TO authenticated
  USING (statut = 'published');

DROP POLICY IF EXISTS "curriculum_service_all_sessions" ON public.training_sessions;
CREATE POLICY "curriculum_service_all_sessions"
  ON public.training_sessions FOR ALL TO service_role
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "curriculum_staff_read_supports" ON public.invariant_supports;
CREATE POLICY "curriculum_staff_read_supports"
  ON public.invariant_supports FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'formateur'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "curriculum_students_read_published_supports" ON public.invariant_supports;
CREATE POLICY "curriculum_students_read_published_supports"
  ON public.invariant_supports FOR SELECT TO authenticated
  USING (statut = 'published');

DROP POLICY IF EXISTS "curriculum_service_all_supports" ON public.invariant_supports;
CREATE POLICY "curriculum_service_all_supports"
  ON public.invariant_supports FOR ALL TO service_role
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "curriculum_staff_read_resources" ON public.session_resources;
CREATE POLICY "curriculum_staff_read_resources"
  ON public.session_resources FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'formateur'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "curriculum_students_read_published_resources" ON public.session_resources;
CREATE POLICY "curriculum_students_read_published_resources"
  ON public.session_resources FOR SELECT TO authenticated
  USING (statut = 'published');

DROP POLICY IF EXISTS "curriculum_service_all_resources" ON public.session_resources;
CREATE POLICY "curriculum_service_all_resources"
  ON public.session_resources FOR ALL TO service_role
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "curriculum_staff_read_variants" ON public.exercise_variants;
CREATE POLICY "curriculum_staff_read_variants"
  ON public.exercise_variants FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'formateur'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "curriculum_students_read_published_variants" ON public.exercise_variants;
CREATE POLICY "curriculum_students_read_published_variants"
  ON public.exercise_variants FOR SELECT TO authenticated
  USING (statut = 'published');

DROP POLICY IF EXISTS "curriculum_service_all_variants" ON public.exercise_variants;
CREATE POLICY "curriculum_service_all_variants"
  ON public.exercise_variants FOR ALL TO service_role
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "curriculum_staff_read_civic_questions" ON public.civic_questions;
CREATE POLICY "curriculum_staff_read_civic_questions"
  ON public.civic_questions FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'formateur'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "curriculum_students_read_published_civic_questions" ON public.civic_questions;
CREATE POLICY "curriculum_students_read_published_civic_questions"
  ON public.civic_questions FOR SELECT TO authenticated
  USING (statut = 'published');

DROP POLICY IF EXISTS "curriculum_service_all_civic_questions" ON public.civic_questions;
CREATE POLICY "curriculum_service_all_civic_questions"
  ON public.civic_questions FOR ALL TO service_role
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "curriculum_staff_read_batches" ON public.resource_generation_batches;
CREATE POLICY "curriculum_staff_read_batches"
  ON public.resource_generation_batches FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'formateur'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "curriculum_service_all_batches" ON public.resource_generation_batches;
CREATE POLICY "curriculum_service_all_batches"
  ON public.resource_generation_batches FOR ALL TO service_role
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "curriculum_staff_read_jobs" ON public.resource_generation_jobs;
CREATE POLICY "curriculum_staff_read_jobs"
  ON public.resource_generation_jobs FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'formateur'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "curriculum_service_all_jobs" ON public.resource_generation_jobs;
CREATE POLICY "curriculum_service_all_jobs"
  ON public.resource_generation_jobs FOR ALL TO service_role
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "curriculum_staff_read_validation_reports" ON public.validation_reports;
CREATE POLICY "curriculum_staff_read_validation_reports"
  ON public.validation_reports FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'formateur'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "curriculum_service_all_validation_reports" ON public.validation_reports;
CREATE POLICY "curriculum_service_all_validation_reports"
  ON public.validation_reports FOR ALL TO service_role
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "curriculum_staff_read_image_assets" ON public.exercise_image_assets;
CREATE POLICY "curriculum_staff_read_image_assets"
  ON public.exercise_image_assets FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'formateur'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "curriculum_service_all_image_assets" ON public.exercise_image_assets;
CREATE POLICY "curriculum_service_all_image_assets"
  ON public.exercise_image_assets FOR ALL TO service_role
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "curriculum_staff_read_publications" ON public.curriculum_publications;
CREATE POLICY "curriculum_staff_read_publications"
  ON public.curriculum_publications FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'formateur'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "curriculum_service_all_publications" ON public.curriculum_publications;
CREATE POLICY "curriculum_service_all_publications"
  ON public.curriculum_publications FOR ALL TO service_role
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "curriculum_staff_read_cohort_pins" ON public.cohort_resource_pins;
CREATE POLICY "curriculum_staff_read_cohort_pins"
  ON public.cohort_resource_pins FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'formateur'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "curriculum_service_all_cohort_pins" ON public.cohort_resource_pins;
CREATE POLICY "curriculum_service_all_cohort_pins"
  ON public.cohort_resource_pins FOR ALL TO service_role
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

COMMIT;
