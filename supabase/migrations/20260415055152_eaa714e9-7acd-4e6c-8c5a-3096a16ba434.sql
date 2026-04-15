
CREATE TABLE IF NOT EXISTS public.pedagogical_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT,
  level_min TEXT CHECK (level_min IN ('A0','A1','A2','B1','B2')),
  level_max TEXT CHECK (level_max IN ('A0','A1','A2','B1','B2')),
  objective TEXT,
  instructions TEXT,
  tags TEXT[] DEFAULT '{}',
  format TEXT,
  competence TEXT CHECK (competence IN ('CO','CE','EE','EO','Structures')),
  source TEXT DEFAULT 'scan',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.pedagogical_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "formateurs_read_activities" ON public.pedagogical_activities
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "admin_manage_activities" ON public.pedagogical_activities
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE INDEX idx_pedagogical_activities_category ON public.pedagogical_activities(category);
CREATE INDEX idx_pedagogical_activities_level ON public.pedagogical_activities(level_min);
CREATE INDEX idx_pedagogical_activities_competence ON public.pedagogical_activities(competence);
