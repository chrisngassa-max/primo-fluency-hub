CREATE INDEX IF NOT EXISTS idx_pedagogical_activities_competence_active 
ON public.pedagogical_activities (competence, is_active);