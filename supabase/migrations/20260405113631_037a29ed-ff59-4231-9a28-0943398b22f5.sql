
-- 1. Create tcf_questions table
CREATE TABLE public.tcf_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  competence text NOT NULL,
  palier int NOT NULL DEFAULT 1,
  enonce text NOT NULL,
  choix jsonb NOT NULL DEFAULT '[]'::jsonb,
  bonne_reponse text NOT NULL,
  type text NOT NULL DEFAULT 'qcm',
  audio text,
  visual text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.tcf_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users read tcf_questions" ON public.tcf_questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage tcf_questions" ON public.tcf_questions FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Add is_public column to sequences_pedagogiques
ALTER TABLE public.sequences_pedagogiques ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;
