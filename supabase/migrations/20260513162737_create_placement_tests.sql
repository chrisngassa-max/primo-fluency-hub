-- Create placement_tests table
CREATE TABLE public.placement_tests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    target_exam TEXT NOT NULL DEFAULT 'TCF_IRN',
    target_public TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published', 'archived')),
    niveaux_couverts TEXT[] NOT NULL DEFAULT '{}',
    competences TEXT[] NOT NULL DEFAULT '{}',
    contexte TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    play_token TEXT UNIQUE, -- Used for the public URL access
    created_by UUID REFERENCES auth.users(id),
    validated_by UUID REFERENCES auth.users(id),
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create placement_test_items table
CREATE TABLE public.placement_test_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    test_id UUID REFERENCES public.placement_tests(id) ON DELETE CASCADE,
    skill TEXT NOT NULL CHECK (skill IN ('CE', 'CO', 'EE', 'EO')),
    level_cecrl TEXT NOT NULL CHECK (level_cecrl IN ('A0', 'A1', 'A2', 'B1', 'B2')),
    difficulty INTEGER CHECK (difficulty >= 1 AND difficulty <= 4),
    context TEXT,
    support_type TEXT,
    support TEXT,
    prompt TEXT,
    question TEXT,
    options JSONB,
    correct_answer TEXT,
    explanation TEXT,
    distractors_analysis TEXT,
    tags TEXT[] DEFAULT '{}',
    score INTEGER DEFAULT 1,
    order_index INTEGER DEFAULT 0,
    is_validated BOOLEAN DEFAULT false,
    audio_script TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create placement_test_attempts table
CREATE TABLE public.placement_test_attempts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    test_id UUID REFERENCES public.placement_tests(id) ON DELETE CASCADE,
    student_id UUID REFERENCES auth.users(id), -- Nullable if external guests
    student_name TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
    total_score INTEGER,
    max_score INTEGER,
    estimated_level TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create placement_test_answers table
CREATE TABLE public.placement_test_answers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    attempt_id UUID REFERENCES public.placement_test_attempts(id) ON DELETE CASCADE,
    item_id UUID REFERENCES public.placement_test_items(id) ON DELETE CASCADE,
    student_answer TEXT,
    is_correct BOOLEAN,
    score INTEGER,
    time_spent INTEGER, -- in seconds
    error_tags TEXT[] DEFAULT '{}',
    teacher_feedback TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create placement_test_results table
CREATE TABLE public.placement_test_results (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    attempt_id UUID UNIQUE REFERENCES public.placement_test_attempts(id) ON DELETE CASCADE,
    global_level TEXT,
    co_level TEXT,
    ce_level TEXT,
    ee_level TEXT,
    eo_level TEXT,
    global_score_pct NUMERIC,
    co_score_pct NUMERIC,
    ce_score_pct NUMERIC,
    ee_score_pct NUMERIC,
    eo_score_pct NUMERIC,
    strengths TEXT[] DEFAULT '{}',
    weaknesses TEXT[] DEFAULT '{}',
    recommended_group TEXT,
    recommended_pathway TEXT,
    teacher_notes TEXT,
    remediation_exercises JSONB,
    raw_analysis JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create placement_test_exports table
CREATE TABLE public.placement_test_exports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    test_id UUID REFERENCES public.placement_tests(id) ON DELETE CASCADE,
    schema_version TEXT DEFAULT 'placement_test_v1',
    export_format TEXT CHECK (export_format IN ('json', 'api')),
    target_site TEXT,
    public_payload JSONB NOT NULL,
    private_answer_key JSONB NOT NULL,
    export_status TEXT DEFAULT 'draft' CHECK (export_status IN ('draft', 'exported', 'synced', 'failed')),
    export_url TEXT,
    access_token TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    exported_at TIMESTAMP WITH TIME ZONE,
    last_synced_at TIMESTAMP WITH TIME ZONE
);

-- Row Level Security (RLS) Configuration

-- Enable RLS on all tables
ALTER TABLE public.placement_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.placement_test_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.placement_test_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.placement_test_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.placement_test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.placement_test_exports ENABLE ROW LEVEL SECURITY;

-- Policies for placement_tests
-- Formateurs can see all tests and manage their own
CREATE POLICY "Formateurs can view all tests" ON public.placement_tests FOR SELECT USING (true); -- Read-only access globally for MVP
CREATE POLICY "Formateurs can insert tests" ON public.placement_tests FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Formateurs can update their tests" ON public.placement_tests FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Policies for placement_test_items
CREATE POLICY "Anyone can view test items" ON public.placement_test_items FOR SELECT USING (true);
CREATE POLICY "Formateurs can insert test items" ON public.placement_test_items FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Formateurs can update test items" ON public.placement_test_items FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Formateurs can delete test items" ON public.placement_test_items FOR DELETE USING (auth.uid() IS NOT NULL);

-- Policies for placement_test_attempts
CREATE POLICY "Anyone can insert attempts" ON public.placement_test_attempts FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can view their attempts" ON public.placement_test_attempts FOR SELECT USING (true);
CREATE POLICY "Users can update their attempts" ON public.placement_test_attempts FOR UPDATE USING (true);

-- Policies for placement_test_answers
CREATE POLICY "Anyone can insert answers" ON public.placement_test_answers FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can view their answers" ON public.placement_test_answers FOR SELECT USING (true);
CREATE POLICY "Users can update their answers" ON public.placement_test_answers FOR UPDATE USING (true);

-- Policies for placement_test_results
CREATE POLICY "Anyone can view results" ON public.placement_test_results FOR SELECT USING (true);
CREATE POLICY "System/Formateurs can insert results" ON public.placement_test_results FOR INSERT WITH CHECK (true);

-- Policies for placement_test_exports
CREATE POLICY "Formateurs can view exports" ON public.placement_test_exports FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Formateurs can insert exports" ON public.placement_test_exports FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Formateurs can update exports" ON public.placement_test_exports FOR UPDATE USING (auth.uid() IS NOT NULL);
