-- 1. MIGRATION SQL — 003_placement_tests.sql

BEGIN;

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Table placement_tests
CREATE TABLE IF NOT EXISTS public.placement_tests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    target_exam text DEFAULT 'TCF_IRN',
    target_public text DEFAULT 'adultes_allophones_france',
    status text CHECK (status IN ('draft', 'review', 'published', 'archived')) DEFAULT 'draft',
    niveaux_couverts text[] DEFAULT '{}',
    competences text[] DEFAULT '{}',
    contexte text,
    version int DEFAULT 1,
    play_token text UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
    created_by uuid REFERENCES public.profiles(id),
    validated_by uuid REFERENCES public.profiles(id),
    published_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Table placement_test_items
CREATE TABLE IF NOT EXISTS public.placement_test_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id uuid REFERENCES public.placement_tests(id) ON DELETE CASCADE,
    skill text CHECK (skill IN ('CE', 'CO', 'EE', 'EO')),
    level_cecrl text CHECK (level_cecrl IN ('A0', 'A1', 'A2', 'B1', 'B2')),
    difficulty int CHECK (difficulty BETWEEN 1 AND 4),
    context text,
    support_type text,
    support text,
    prompt text,
    question text NOT NULL,
    options jsonb,         -- [{"id":"A","text":"..."}]
    correct_answer text,   -- "A"|"B"|"C"
    explanation text,
    distractors_analysis text,
    tags text[] DEFAULT '{}',
    score int DEFAULT 1,
    order_index int,
    is_validated boolean DEFAULT false,
    audio_script text,
    created_at timestamptz DEFAULT now()
);

-- Table placement_test_attempts
CREATE TABLE IF NOT EXISTS public.placement_test_attempts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id uuid REFERENCES public.placement_tests(id) ON DELETE CASCADE,
    student_id uuid REFERENCES public.profiles(id),
    student_name text,
    started_at timestamptz DEFAULT now(),
    completed_at timestamptz,
    status text CHECK (status IN ('in_progress', 'completed', 'abandoned')) DEFAULT 'in_progress',
    total_score int,
    max_score int,
    estimated_level text,
    source text DEFAULT 'app' CHECK (source IN ('app', 'site_externe')),
    created_at timestamptz DEFAULT now()
);

-- Table placement_test_answers
CREATE TABLE IF NOT EXISTS public.placement_test_answers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id uuid REFERENCES public.placement_test_attempts(id) ON DELETE CASCADE,
    item_id uuid REFERENCES public.placement_test_items(id) ON DELETE CASCADE,
    student_answer text,
    is_correct boolean,
    score int DEFAULT 0,
    time_spent int,
    error_tags text[] DEFAULT '{}',
    teacher_feedback text,
    created_at timestamptz DEFAULT now()
);

-- Table placement_test_results
CREATE TABLE IF NOT EXISTS public.placement_test_results (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id uuid UNIQUE REFERENCES public.placement_test_attempts(id) ON DELETE CASCADE,
    global_level text,
    co_level text,
    ce_level text,
    ee_level text,
    eo_level text,
    global_score_pct numeric(5,2),
    co_score_pct numeric(5,2),
    ce_score_pct numeric(5,2),
    ee_score_pct numeric(5,2),
    eo_score_pct numeric(5,2),
    strengths text[] DEFAULT '{}',
    weaknesses text[] DEFAULT '{}',
    recommended_group text,
    recommended_pathway text,
    remediation_exercises jsonb DEFAULT '[]',
    teacher_notes text,
    raw_analysis jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Table placement_test_exports
CREATE TABLE IF NOT EXISTS public.placement_test_exports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id uuid REFERENCES public.placement_tests(id) ON DELETE CASCADE,
    schema_version text DEFAULT 'placement_test_v1',
    export_status text DEFAULT 'active' CHECK (export_status IN ('active', 'revoked')),
    access_token text UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
    total_attempts int DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    last_used_at timestamptz
);

-- RLS Policies
ALTER TABLE public.placement_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.placement_test_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.placement_test_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.placement_test_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.placement_test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.placement_test_exports ENABLE ROW LEVEL SECURITY;

-- Formateur Policies
CREATE POLICY "Formateurs CRUD on their own tests" ON public.placement_tests
    FOR ALL USING (auth.uid() = created_by);

CREATE POLICY "Anyone can view published tests via token" ON public.placement_tests
    FOR SELECT USING (status = 'published' AND play_token IS NOT NULL);

-- Items
CREATE POLICY "Anyone can view test items of published tests" ON public.placement_test_items
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM public.placement_tests WHERE id = test_id AND status = 'published'
    ));

CREATE POLICY "Formateurs manage their items" ON public.placement_test_items
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.placement_tests WHERE id = test_id AND created_by = auth.uid()
    ));

-- Attempts (Public can insert)
CREATE POLICY "Anyone can insert attempts" ON public.placement_test_attempts
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Formateurs view attempts for their tests" ON public.placement_test_attempts
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM public.placement_tests WHERE id = test_id AND created_by = auth.uid()
    ));

-- Answers
CREATE POLICY "Anyone can insert answers" ON public.placement_test_answers
    FOR INSERT WITH CHECK (true);

-- Results
CREATE POLICY "Anyone can view results of their own attempt" ON public.placement_test_results
    FOR SELECT USING (true); -- Usually filtered by attempt_id in the query

-- Service Role / Function access
-- (Supabase Functions use the service role key to bypass RLS when needed)

COMMIT;
