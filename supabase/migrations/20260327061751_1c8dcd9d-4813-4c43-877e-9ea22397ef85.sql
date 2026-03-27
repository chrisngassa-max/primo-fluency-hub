
-- Table test_questions
CREATE TABLE public.test_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competence TEXT NOT NULL CHECK (competence IN ('CO', 'CE', 'EO', 'EE')),
  palier INTEGER NOT NULL CHECK (palier IN (1, 2, 3, 4)),
  numero_dans_palier INTEGER NOT NULL CHECK (numero_dans_palier IN (1, 2, 3)),
  consigne TEXT NOT NULL,
  support TEXT,
  script_audio TEXT,
  type_reponse TEXT NOT NULL CHECK (type_reponse IN ('qcm', 'oral', 'ecrit')),
  choix_a TEXT,
  choix_b TEXT,
  choix_c TEXT,
  reponse_correcte TEXT CHECK (reponse_correcte IN ('A', 'B', 'C')),
  criteres_evaluation JSONB,
  points_max INTEGER DEFAULT 3
);

ALTER TABLE public.test_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users read test_questions" ON public.test_questions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage test_questions" ON public.test_questions
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Table test_sessions
CREATE TABLE public.test_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  apprenant_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  date_debut TIMESTAMP WITH TIME ZONE DEFAULT now(),
  date_fin TIMESTAMP WITH TIME ZONE,
  statut TEXT DEFAULT 'en_cours' CHECK (statut IN ('en_cours', 'termine')),
  palier_co INTEGER DEFAULT 1,
  palier_ce INTEGER DEFAULT 1,
  palier_eo INTEGER DEFAULT 1,
  palier_ee INTEGER DEFAULT 1,
  score_co INTEGER DEFAULT 0,
  score_ce INTEGER DEFAULT 0,
  score_eo INTEGER DEFAULT 0,
  score_ee INTEGER DEFAULT 0,
  profil_final TEXT CHECK (profil_final IN ('A0_bas', 'A0_intermediaire', 'A0_haut', 'A1_maitrise')),
  groupe_suggere TEXT CHECK (groupe_suggere IN ('groupe_1', 'groupe_2')),
  groupe_valide_par_formateur TEXT
);

ALTER TABLE public.test_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Eleves manage own test_sessions" ON public.test_sessions
  FOR ALL USING (apprenant_id = auth.uid()) WITH CHECK (apprenant_id = auth.uid());

CREATE POLICY "Formateurs view student test_sessions" ON public.test_sessions
  FOR SELECT USING (apprenant_id IN (
    SELECT gm.eleve_id FROM group_members gm
    JOIN groups g ON g.id = gm.group_id
    WHERE g.formateur_id = auth.uid()
  ));

CREATE POLICY "Formateurs update test_sessions" ON public.test_sessions
  FOR UPDATE USING (apprenant_id IN (
    SELECT gm.eleve_id FROM group_members gm
    JOIN groups g ON g.id = gm.group_id
    WHERE g.formateur_id = auth.uid()
  )) WITH CHECK (apprenant_id IN (
    SELECT gm.eleve_id FROM group_members gm
    JOIN groups g ON g.id = gm.group_id
    WHERE g.formateur_id = auth.uid()
  ));

-- Table test_reponses
CREATE TABLE public.test_reponses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.test_sessions(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES public.test_questions(id) NOT NULL,
  competence TEXT NOT NULL,
  palier INTEGER NOT NULL,
  reponse_apprenant TEXT,
  reponse_audio_url TEXT,
  score_obtenu INTEGER,
  score_ia INTEGER,
  score_formateur INTEGER,
  justification_ia TEXT,
  est_correct BOOLEAN,
  date_reponse TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.test_reponses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Eleves manage own test_reponses" ON public.test_reponses
  FOR ALL USING (session_id IN (
    SELECT id FROM public.test_sessions WHERE apprenant_id = auth.uid()
  )) WITH CHECK (session_id IN (
    SELECT id FROM public.test_sessions WHERE apprenant_id = auth.uid()
  ));

CREATE POLICY "Formateurs view student test_reponses" ON public.test_reponses
  FOR SELECT USING (session_id IN (
    SELECT ts.id FROM public.test_sessions ts
    WHERE ts.apprenant_id IN (
      SELECT gm.eleve_id FROM group_members gm
      JOIN groups g ON g.id = gm.group_id
      WHERE g.formateur_id = auth.uid()
    )
  ));

CREATE POLICY "Formateurs update test_reponses" ON public.test_reponses
  FOR UPDATE USING (session_id IN (
    SELECT ts.id FROM public.test_sessions ts
    WHERE ts.apprenant_id IN (
      SELECT gm.eleve_id FROM group_members gm
      JOIN groups g ON g.id = gm.group_id
      WHERE g.formateur_id = auth.uid()
    )
  )) WITH CHECK (session_id IN (
    SELECT ts.id FROM public.test_sessions ts
    WHERE ts.apprenant_id IN (
      SELECT gm.eleve_id FROM group_members gm
      JOIN groups g ON g.id = gm.group_id
      WHERE g.formateur_id = auth.uid()
    )
  ));

-- Table test_resultats_apprenants
CREATE TABLE public.test_resultats_apprenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  apprenant_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES public.test_sessions(id) ON DELETE CASCADE NOT NULL,
  score_total INTEGER,
  score_co INTEGER,
  score_ce INTEGER,
  score_eo INTEGER,
  score_ee INTEGER,
  palier_final_co INTEGER,
  palier_final_ce INTEGER,
  palier_final_eo INTEGER,
  palier_final_ee INTEGER,
  profil TEXT CHECK (profil IN ('A0_bas', 'A0_intermediaire', 'A0_haut', 'A1_maitrise')),
  groupe_suggere TEXT,
  groupe_confirme TEXT,
  date_test TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.test_resultats_apprenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Eleves view own resultats_apprenants" ON public.test_resultats_apprenants
  FOR SELECT USING (apprenant_id = auth.uid());

CREATE POLICY "Eleves insert own resultats_apprenants" ON public.test_resultats_apprenants
  FOR INSERT WITH CHECK (apprenant_id = auth.uid());

CREATE POLICY "Formateurs view student resultats_apprenants" ON public.test_resultats_apprenants
  FOR SELECT USING (apprenant_id IN (
    SELECT gm.eleve_id FROM group_members gm
    JOIN groups g ON g.id = gm.group_id
    WHERE g.formateur_id = auth.uid()
  ));

CREATE POLICY "Formateurs update resultats_apprenants" ON public.test_resultats_apprenants
  FOR UPDATE USING (apprenant_id IN (
    SELECT gm.eleve_id FROM group_members gm
    JOIN groups g ON g.id = gm.group_id
    WHERE g.formateur_id = auth.uid()
  )) WITH CHECK (apprenant_id IN (
    SELECT gm.eleve_id FROM group_members gm
    JOIN groups g ON g.id = gm.group_id
    WHERE g.formateur_id = auth.uid()
  ));

-- Storage bucket for audio recordings
INSERT INTO storage.buckets (id, name, public) VALUES ('test-audio', 'test-audio', false);

CREATE POLICY "Auth users upload test audio" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'test-audio');

CREATE POLICY "Auth users read own test audio" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'test-audio');
