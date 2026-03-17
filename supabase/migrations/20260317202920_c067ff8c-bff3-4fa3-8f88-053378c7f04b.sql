
-- Enable RLS on reference tables
ALTER TABLE public.epreuves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sous_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.points_a_maitriser ENABLE ROW LEVEL SECURITY;

-- These are read-only reference data, accessible by all authenticated users
CREATE POLICY "Auth users read epreuves" ON public.epreuves FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage epreuves" ON public.epreuves FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Auth users read sous_sections" ON public.sous_sections FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage sous_sections" ON public.sous_sections FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Auth users read points" ON public.points_a_maitriser FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage points" ON public.points_a_maitriser FOR ALL USING (public.has_role(auth.uid(), 'admin'));
