
-- ============================================================
-- SECURITY DEFINER FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.get_group_formateur(_group_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT formateur_id FROM public.groups WHERE id = _group_id;
$$;

CREATE OR REPLACE FUNCTION public.get_session_formateur(_session_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT g.formateur_id
  FROM public.sessions s
  JOIN public.groups g ON g.id = s.group_id
  WHERE s.id = _session_id;
$$;

-- ============================================================
-- TRIGGER: auto-create profile on signup
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nom, prenom)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'nom', ''),
    COALESCE(NEW.raw_user_meta_data->>'prenom', '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- profiles
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Formateurs view their students" ON public.profiles FOR SELECT USING (
  public.has_role(auth.uid(), 'formateur') AND id IN (
    SELECT gm.eleve_id FROM public.group_members gm JOIN public.groups g ON g.id = gm.group_id WHERE g.formateur_id = auth.uid()
  )
);
CREATE POLICY "Admins view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- user_roles
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- groups
CREATE POLICY "Formateurs manage own groups" ON public.groups FOR ALL USING (formateur_id = auth.uid()) WITH CHECK (formateur_id = auth.uid());
CREATE POLICY "Eleves view their groups" ON public.groups FOR SELECT USING (id IN (SELECT group_id FROM public.group_members WHERE eleve_id = auth.uid()));
CREATE POLICY "Admins view all groups" ON public.groups FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- group_members
CREATE POLICY "Formateurs manage members" ON public.group_members FOR ALL USING (public.get_group_formateur(group_id) = auth.uid()) WITH CHECK (public.get_group_formateur(group_id) = auth.uid());
CREATE POLICY "Eleves view own memberships" ON public.group_members FOR SELECT USING (eleve_id = auth.uid());

-- sessions
CREATE POLICY "Formateurs manage sessions" ON public.sessions FOR ALL USING (public.get_group_formateur(group_id) = auth.uid()) WITH CHECK (public.get_group_formateur(group_id) = auth.uid());
CREATE POLICY "Eleves view their sessions" ON public.sessions FOR SELECT USING (group_id IN (SELECT group_id FROM public.group_members WHERE eleve_id = auth.uid()));

-- sequences_pedagogiques
CREATE POLICY "Formateurs manage own sequences" ON public.sequences_pedagogiques FOR ALL USING (formateur_id = auth.uid()) WITH CHECK (formateur_id = auth.uid());

-- exercices
CREATE POLICY "Formateurs manage own exercices" ON public.exercices FOR ALL USING (formateur_id = auth.uid()) WITH CHECK (formateur_id = auth.uid());
CREATE POLICY "Eleves view assigned exercices" ON public.exercices FOR SELECT USING (
  eleve_id = auth.uid() OR id IN (
    SELECT se.exercice_id FROM public.session_exercices se
    JOIN public.sessions s ON s.id = se.session_id
    WHERE s.group_id IN (SELECT group_id FROM public.group_members WHERE eleve_id = auth.uid())
  )
);

-- session_exercices
CREATE POLICY "Formateurs manage session_exercices" ON public.session_exercices FOR ALL USING (public.get_session_formateur(session_id) = auth.uid()) WITH CHECK (public.get_session_formateur(session_id) = auth.uid());
CREATE POLICY "Eleves view session_exercices" ON public.session_exercices FOR SELECT USING (
  session_id IN (SELECT s.id FROM public.sessions s JOIN public.group_members gm ON gm.group_id = s.group_id WHERE gm.eleve_id = auth.uid())
);

-- resultats
CREATE POLICY "Eleves manage own resultats" ON public.resultats FOR ALL USING (eleve_id = auth.uid()) WITH CHECK (eleve_id = auth.uid());
CREATE POLICY "Formateurs view student resultats" ON public.resultats FOR SELECT USING (
  eleve_id IN (SELECT gm.eleve_id FROM public.group_members gm JOIN public.groups g ON g.id = gm.group_id WHERE g.formateur_id = auth.uid())
);

-- tests_entree
CREATE POLICY "Eleves manage own test" ON public.tests_entree FOR ALL USING (eleve_id = auth.uid()) WITH CHECK (eleve_id = auth.uid());
CREATE POLICY "Formateurs view student tests" ON public.tests_entree FOR SELECT USING (
  eleve_id IN (SELECT gm.eleve_id FROM public.group_members gm JOIN public.groups g ON g.id = gm.group_id WHERE g.formateur_id = auth.uid())
);

-- test_entree_items
CREATE POLICY "Auth users read test items" ON public.test_entree_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage test items" ON public.test_entree_items FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- devoirs
CREATE POLICY "Formateurs manage devoirs" ON public.devoirs FOR ALL USING (formateur_id = auth.uid()) WITH CHECK (formateur_id = auth.uid());
CREATE POLICY "Eleves view own devoirs" ON public.devoirs FOR SELECT USING (eleve_id = auth.uid());
CREATE POLICY "Eleves update own devoirs" ON public.devoirs FOR UPDATE USING (eleve_id = auth.uid()) WITH CHECK (eleve_id = auth.uid());

-- profils_eleves
CREATE POLICY "Eleves view own profil" ON public.profils_eleves FOR SELECT USING (eleve_id = auth.uid());
CREATE POLICY "Formateurs view student profils" ON public.profils_eleves FOR SELECT USING (
  eleve_id IN (SELECT gm.eleve_id FROM public.group_members gm JOIN public.groups g ON g.id = gm.group_id WHERE g.formateur_id = auth.uid())
);
CREATE POLICY "Eleves manage own profil" ON public.profils_eleves FOR ALL USING (eleve_id = auth.uid()) WITH CHECK (eleve_id = auth.uid());

-- student_competency_status
CREATE POLICY "Eleves view own competency" ON public.student_competency_status FOR SELECT USING (eleve_id = auth.uid());
CREATE POLICY "Formateurs view student competency" ON public.student_competency_status FOR SELECT USING (
  eleve_id IN (SELECT gm.eleve_id FROM public.group_members gm JOIN public.groups g ON g.id = gm.group_id WHERE g.formateur_id = auth.uid())
);
CREATE POLICY "Eleves manage own competency" ON public.student_competency_status FOR ALL USING (eleve_id = auth.uid()) WITH CHECK (eleve_id = auth.uid());

-- alertes
CREATE POLICY "Formateurs manage own alertes" ON public.alertes FOR ALL USING (formateur_id = auth.uid()) WITH CHECK (formateur_id = auth.uid());
CREATE POLICY "Eleves view own alertes" ON public.alertes FOR SELECT USING (eleve_id = auth.uid());

-- parametres
CREATE POLICY "Formateurs manage own parametres" ON public.parametres FOR ALL USING (formateur_id = auth.uid()) WITH CHECK (formateur_id = auth.uid());

-- notifications
CREATE POLICY "Users manage own notifications" ON public.notifications FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- activity_logs
CREATE POLICY "Users view own logs" ON public.activity_logs FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users insert own logs" ON public.activity_logs FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins view all logs" ON public.activity_logs FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
