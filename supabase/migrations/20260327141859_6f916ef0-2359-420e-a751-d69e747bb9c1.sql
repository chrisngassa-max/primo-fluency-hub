
CREATE TABLE public.presences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  eleve_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  present BOOLEAN NOT NULL DEFAULT false,
  commentaire TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(session_id, eleve_id)
);

ALTER TABLE public.presences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Formateurs manage presences" ON public.presences
  FOR ALL TO public
  USING (get_session_formateur(session_id) = auth.uid())
  WITH CHECK (get_session_formateur(session_id) = auth.uid());

CREATE POLICY "Eleves view own presences" ON public.presences
  FOR SELECT TO public
  USING (eleve_id = auth.uid());
