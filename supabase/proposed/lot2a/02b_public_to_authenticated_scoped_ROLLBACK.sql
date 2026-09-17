-- ROLLBACK proposed for B1 — restore TO public (default)
-- Count: 90

DROP POLICY IF EXISTS 'Users insert own logs' ON public."activity_logs";
CREATE POLICY 'Users insert own logs'
  ON public."activity_logs"
  AS PERMISSIVE
  FOR INSERT
  WITH CHECK ((user_id = auth.uid()))
;

DROP POLICY IF EXISTS 'Users view own logs' ON public."activity_logs";
CREATE POLICY 'Users view own logs'
  ON public."activity_logs"
  AS PERMISSIVE
  FOR SELECT
  USING ((user_id = auth.uid()))
;

DROP POLICY IF EXISTS 'users insert own consent' ON public."ai_processing_consents";
CREATE POLICY 'users insert own consent'
  ON public."ai_processing_consents"
  AS PERMISSIVE
  FOR INSERT
  WITH CHECK ((user_id = auth.uid()))
;

DROP POLICY IF EXISTS 'users select own consent' ON public."ai_processing_consents";
CREATE POLICY 'users select own consent'
  ON public."ai_processing_consents"
  AS PERMISSIVE
  FOR SELECT
  USING ((user_id = auth.uid()))
;

DROP POLICY IF EXISTS 'users update own consent' ON public."ai_processing_consents";
CREATE POLICY 'users update own consent'
  ON public."ai_processing_consents"
  AS PERMISSIVE
  FOR UPDATE
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()))
;

DROP POLICY IF EXISTS 'users read own ai logs' ON public."ai_processing_logs";
CREATE POLICY 'users read own ai logs'
  ON public."ai_processing_logs"
  AS PERMISSIVE
  FOR SELECT
  USING ((subject_user_id = auth.uid()))
;

DROP POLICY IF EXISTS 'Eleves view own alertes' ON public."alertes";
CREATE POLICY 'Eleves view own alertes'
  ON public."alertes"
  AS PERMISSIVE
  FOR SELECT
  USING ((eleve_id = auth.uid()))
;

DROP POLICY IF EXISTS 'Formateurs manage own alertes' ON public."alertes";
CREATE POLICY 'Formateurs manage own alertes'
  ON public."alertes"
  AS PERMISSIVE
  FOR ALL
  USING ((formateur_id = auth.uid()))
  WITH CHECK ((formateur_id = auth.uid()))
;

DROP POLICY IF EXISTS 'atelier_bilans_insert' ON public."atelier_bilans";
CREATE POLICY 'atelier_bilans_insert'
  ON public."atelier_bilans"
  AS PERMISSIVE
  FOR INSERT
  WITH CHECK ((formateur_id = auth.uid()))
;

DROP POLICY IF EXISTS 'atelier_bilans_select' ON public."atelier_bilans";
CREATE POLICY 'atelier_bilans_select'
  ON public."atelier_bilans"
  AS PERMISSIVE
  FOR SELECT
  USING ((formateur_id = auth.uid()))
;

DROP POLICY IF EXISTS 'atelier_bilans_update' ON public."atelier_bilans";
CREATE POLICY 'atelier_bilans_update'
  ON public."atelier_bilans"
  AS PERMISSIVE
  FOR UPDATE
  USING ((formateur_id = auth.uid()))
;

DROP POLICY IF EXISTS 'Eleves view own bilan_post_devoirs' ON public."bilan_post_devoirs";
CREATE POLICY 'Eleves view own bilan_post_devoirs'
  ON public."bilan_post_devoirs"
  AS PERMISSIVE
  FOR SELECT
  USING ((eleve_id = auth.uid()))
;

DROP POLICY IF EXISTS 'Formateurs manage own bilan_post_devoirs' ON public."bilan_post_devoirs";
CREATE POLICY 'Formateurs manage own bilan_post_devoirs'
  ON public."bilan_post_devoirs"
  AS PERMISSIVE
  FOR ALL
  USING ((formateur_id = auth.uid()))
  WITH CHECK ((formateur_id = auth.uid()))
;

DROP POLICY IF EXISTS 'Eleves insert own bilan_test_results' ON public."bilan_test_results";
CREATE POLICY 'Eleves insert own bilan_test_results'
  ON public."bilan_test_results"
  AS PERMISSIVE
  FOR INSERT
  WITH CHECK ((eleve_id = auth.uid()))
;

DROP POLICY IF EXISTS 'Eleves view own bilan_test_results' ON public."bilan_test_results";
CREATE POLICY 'Eleves view own bilan_test_results'
  ON public."bilan_test_results"
  AS PERMISSIVE
  FOR SELECT
  USING ((eleve_id = auth.uid()))
;

DROP POLICY IF EXISTS 'Formateurs view bilan_test_results' ON public."bilan_test_results";
CREATE POLICY 'Formateurs view bilan_test_results'
  ON public."bilan_test_results"
  AS PERMISSIVE
  FOR SELECT
  USING ((bilan_test_id IN ( SELECT bilan_tests.id
   FROM bilan_tests
  WHERE (bilan_tests.formateur_id = auth.uid()))))
;

DROP POLICY IF EXISTS 'Eleves view sent bilan_tests' ON public."bilan_tests";
CREATE POLICY 'Eleves view sent bilan_tests'
  ON public."bilan_tests"
  AS PERMISSIVE
  FOR SELECT
  USING (((statut = 'envoye'::text) AND (session_id IN ( SELECT s.id
   FROM (sessions s
     JOIN group_members gm ON ((gm.group_id = s.group_id)))
  WHERE (gm.eleve_id = auth.uid())))))
;

DROP POLICY IF EXISTS 'Formateurs manage own bilan_tests' ON public."bilan_tests";
CREATE POLICY 'Formateurs manage own bilan_tests'
  ON public."bilan_tests"
  AS PERMISSIVE
  FOR ALL
  USING ((formateur_id = auth.uid()))
  WITH CHECK ((formateur_id = auth.uid()))
;

DROP POLICY IF EXISTS 'Eleves view own devoirs' ON public."devoirs";
CREATE POLICY 'Eleves view own devoirs'
  ON public."devoirs"
  AS PERMISSIVE
  FOR SELECT
  USING ((eleve_id = auth.uid()))
;

DROP POLICY IF EXISTS 'Formateurs manage devoirs' ON public."devoirs";
CREATE POLICY 'Formateurs manage devoirs'
  ON public."devoirs"
  AS PERMISSIVE
  FOR ALL
  USING ((formateur_id = auth.uid()))
  WITH CHECK ((formateur_id = auth.uid()))
;

DROP POLICY IF EXISTS 'Eleves view own diagnostics' ON public."diagnostic_entree";
CREATE POLICY 'Eleves view own diagnostics'
  ON public."diagnostic_entree"
  AS PERMISSIVE
  FOR SELECT
  USING ((eleve_id = auth.uid()))
;

DROP POLICY IF EXISTS 'Formateurs manage own diagnostics' ON public."diagnostic_entree";
CREATE POLICY 'Formateurs manage own diagnostics'
  ON public."diagnostic_entree"
  AS PERMISSIVE
  FOR ALL
  USING ((formateur_id = auth.uid()))
  WITH CHECK ((formateur_id = auth.uid()))
;

DROP POLICY IF EXISTS 'Formateurs view student diagnostics' ON public."diagnostic_entree";
CREATE POLICY 'Formateurs view student diagnostics'
  ON public."diagnostic_entree"
  AS PERMISSIVE
  FOR SELECT
  USING ((eleve_id IN ( SELECT gm.eleve_id
   FROM (group_members gm
     JOIN groups g ON ((g.id = gm.group_id)))
  WHERE (g.formateur_id = auth.uid()))))
;

DROP POLICY IF EXISTS 'Eleves view assigned exercices secure' ON public."exercices";
CREATE POLICY 'Eleves view assigned exercices secure'
  ON public."exercices"
  AS PERMISSIVE
  FOR SELECT
  USING (((eleve_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM ((session_exercices se
     JOIN sessions s ON ((s.id = se.session_id)))
     JOIN group_members gm ON ((gm.group_id = s.group_id)))
  WHERE ((se.exercice_id = exercices.id) AND (gm.eleve_id = auth.uid()) AND ((se.eleve_id IS NULL) OR (se.eleve_id = auth.uid())))))))
;

DROP POLICY IF EXISTS 'auth_read_validated_exercises' ON public."exercices";
CREATE POLICY 'auth_read_validated_exercises'
  ON public."exercices"
  AS PERMISSIVE
  FOR SELECT
  USING (((auth.uid() IS NOT NULL) AND (statut = ANY (ARRAY['validated'::text, 'published'::text]))))
;

DROP POLICY IF EXISTS 'eleves_view_assigned_exercices' ON public."exercices";
CREATE POLICY 'eleves_view_assigned_exercices'
  ON public."exercices"
  AS PERMISSIVE
  FOR SELECT
  USING (((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM exercise_assignments
  WHERE ((exercise_assignments.exercise_id = exercices.id) AND (exercise_assignments.learner_id = auth.uid()))))))
;

DROP POLICY IF EXISTS 'formateur_own_exercises' ON public."exercices";
CREATE POLICY 'formateur_own_exercises'
  ON public."exercices"
  AS PERMISSIVE
  FOR ALL
  USING ((formateur_id = auth.uid()))
  WITH CHECK ((formateur_id = auth.uid()))
;

DROP POLICY IF EXISTS 'formateur_assignments' ON public."exercise_assignments";
CREATE POLICY 'formateur_assignments'
  ON public."exercise_assignments"
  AS PERMISSIVE
  FOR ALL
  USING ((assigned_by = auth.uid()))
  WITH CHECK ((assigned_by = auth.uid()))
;

DROP POLICY IF EXISTS 'learner_own_assignments' ON public."exercise_assignments";
CREATE POLICY 'learner_own_assignments'
  ON public."exercise_assignments"
  AS PERMISSIVE
  FOR SELECT
  USING ((learner_id = auth.uid()))
;

DROP POLICY IF EXISTS 'formateur_read_attempts' ON public."exercise_attempts";
CREATE POLICY 'formateur_read_attempts'
  ON public."exercise_attempts"
  AS PERMISSIVE
  FOR SELECT
  USING ((EXISTS ( SELECT 1
   FROM exercices
  WHERE ((exercices.id = exercise_attempts.exercise_id) AND (exercices.formateur_id = auth.uid())))))
;

DROP POLICY IF EXISTS 'learner_insert_own_attempts' ON public."exercise_attempts";
CREATE POLICY 'learner_insert_own_attempts'
  ON public."exercise_attempts"
  AS PERMISSIVE
  FOR INSERT
  WITH CHECK (((learner_id = auth.uid()) AND (status = 'in_progress'::text)))
;

DROP POLICY IF EXISTS 'learner_select_own_attempts' ON public."exercise_attempts";
CREATE POLICY 'learner_select_own_attempts'
  ON public."exercise_attempts"
  AS PERMISSIVE
  FOR SELECT
  USING ((learner_id = auth.uid()))
;

DROP POLICY IF EXISTS 'learner_update_own_inprogress_attempts' ON public."exercise_attempts";
CREATE POLICY 'learner_update_own_inprogress_attempts'
  ON public."exercise_attempts"
  AS PERMISSIVE
  FOR UPDATE
  USING (((learner_id = auth.uid()) AND (status = 'in_progress'::text)))
  WITH CHECK ((learner_id = auth.uid()))
;

DROP POLICY IF EXISTS 'eleve_manage_own_results' ON public."external_resource_results";
CREATE POLICY 'eleve_manage_own_results'
  ON public."external_resource_results"
  AS PERMISSIVE
  FOR ALL
  USING ((student_id = auth.uid()))
  WITH CHECK ((student_id = auth.uid()))
;

DROP POLICY IF EXISTS 'formateur_read_validate_results' ON public."external_resource_results";
CREATE POLICY 'formateur_read_validate_results'
  ON public."external_resource_results"
  AS PERMISSIVE
  FOR ALL
  USING ((EXISTS ( SELECT 1
   FROM ((external_resources er
     JOIN sessions s ON ((s.id = er.session_id)))
     JOIN groups g ON ((g.id = s.group_id)))
  WHERE ((er.id = external_resource_results.external_resource_id) AND (g.formateur_id = auth.uid())))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM ((external_resources er
     JOIN sessions s ON ((s.id = er.session_id)))
     JOIN groups g ON ((g.id = s.group_id)))
  WHERE ((er.id = external_resource_results.external_resource_id) AND (g.formateur_id = auth.uid())))))
;

DROP POLICY IF EXISTS 'eleve_select_external_resources' ON public."external_resources";
CREATE POLICY 'eleve_select_external_resources'
  ON public."external_resources"
  AS PERMISSIVE
  FOR SELECT
  USING ((EXISTS ( SELECT 1
   FROM (sessions s
     JOIN group_members gm ON ((gm.group_id = s.group_id)))
  WHERE ((s.id = external_resources.session_id) AND (gm.eleve_id = auth.uid())))))
;

DROP POLICY IF EXISTS 'formateur_crud_external_resources' ON public."external_resources";
CREATE POLICY 'formateur_crud_external_resources'
  ON public."external_resources"
  AS PERMISSIVE
  FOR ALL
  USING ((created_by = auth.uid()))
  WITH CHECK ((created_by = auth.uid()))
;

DROP POLICY IF EXISTS 'Formateurs manage own invitations' ON public."group_invitations";
CREATE POLICY 'Formateurs manage own invitations'
  ON public."group_invitations"
  AS PERMISSIVE
  FOR ALL
  USING ((get_group_formateur(group_id) = auth.uid()))
  WITH CHECK ((get_group_formateur(group_id) = auth.uid()))
;

DROP POLICY IF EXISTS 'Eleves view own memberships' ON public."group_members";
CREATE POLICY 'Eleves view own memberships'
  ON public."group_members"
  AS PERMISSIVE
  FOR SELECT
  USING ((eleve_id = auth.uid()))
;

DROP POLICY IF EXISTS 'Formateurs manage members' ON public."group_members";
CREATE POLICY 'Formateurs manage members'
  ON public."group_members"
  AS PERMISSIVE
  FOR ALL
  USING ((get_group_formateur(group_id) = auth.uid()))
  WITH CHECK ((get_group_formateur(group_id) = auth.uid()))
;

DROP POLICY IF EXISTS 'Eleves view their groups' ON public."groups";
CREATE POLICY 'Eleves view their groups'
  ON public."groups"
  AS PERMISSIVE
  FOR SELECT
  USING ((id IN ( SELECT group_members.group_id
   FROM group_members
  WHERE (group_members.eleve_id = auth.uid()))))
;

DROP POLICY IF EXISTS 'Formateurs manage own groups' ON public."groups";
CREATE POLICY 'Formateurs manage own groups'
  ON public."groups"
  AS PERMISSIVE
  FOR ALL
  USING ((formateur_id = auth.uid()))
  WITH CHECK ((formateur_id = auth.uid()))
;

DROP POLICY IF EXISTS 'formateurs view own queue' ON public."homework_generation_queue";
CREATE POLICY 'formateurs view own queue'
  ON public."homework_generation_queue"
  AS PERMISSIVE
  FOR SELECT
  USING ((formateur_id = auth.uid()))
;

DROP POLICY IF EXISTS 'interventions_delete' ON public."interventions";
CREATE POLICY 'interventions_delete'
  ON public."interventions"
  AS PERMISSIVE
  FOR DELETE
  USING ((formateur_id = auth.uid()))
;

DROP POLICY IF EXISTS 'interventions_insert' ON public."interventions";
CREATE POLICY 'interventions_insert'
  ON public."interventions"
  AS PERMISSIVE
  FOR INSERT
  WITH CHECK ((formateur_id = auth.uid()))
;

DROP POLICY IF EXISTS 'interventions_select' ON public."interventions";
CREATE POLICY 'interventions_select'
  ON public."interventions"
  AS PERMISSIVE
  FOR SELECT
  USING (((formateur_id = auth.uid()) OR (is_systeme = true)))
;

DROP POLICY IF EXISTS 'interventions_update' ON public."interventions";
CREATE POLICY 'interventions_update'
  ON public."interventions"
  AS PERMISSIVE
  FOR UPDATE
  USING ((formateur_id = auth.uid()))
;

DROP POLICY IF EXISTS 'Users manage own notifications' ON public."notifications";
CREATE POLICY 'Users manage own notifications'
  ON public."notifications"
  AS PERMISSIVE
  FOR ALL
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()))
;

DROP POLICY IF EXISTS 'Formateurs manage own parametres' ON public."parametres";
CREATE POLICY 'Formateurs manage own parametres'
  ON public."parametres"
  AS PERMISSIVE
  FOR ALL
  USING ((formateur_id = auth.uid()))
  WITH CHECK ((formateur_id = auth.uid()))
;

DROP POLICY IF EXISTS 'Formateurs manage own parcours' ON public."parcours";
CREATE POLICY 'Formateurs manage own parcours'
  ON public."parcours"
  AS PERMISSIVE
  FOR ALL
  USING ((formateur_id = auth.uid()))
  WITH CHECK ((formateur_id = auth.uid()))
;

DROP POLICY IF EXISTS 'Formateurs manage parcours_seances' ON public."parcours_seances";
CREATE POLICY 'Formateurs manage parcours_seances'
  ON public."parcours_seances"
  AS PERMISSIVE
  FOR ALL
  USING ((get_parcours_formateur(parcours_id) = auth.uid()))
  WITH CHECK ((get_parcours_formateur(parcours_id) = auth.uid()))
;

DROP POLICY IF EXISTS 'Eleves view own presences' ON public."presences";
CREATE POLICY 'Eleves view own presences'
  ON public."presences"
  AS PERMISSIVE
  FOR SELECT
  USING ((eleve_id = auth.uid()))
;

DROP POLICY IF EXISTS 'Formateurs manage presences' ON public."presences";
CREATE POLICY 'Formateurs manage presences'
  ON public."presences"
  AS PERMISSIVE
  FOR ALL
  USING ((get_session_formateur(session_id) = auth.uid()))
  WITH CHECK ((get_session_formateur(session_id) = auth.uid()))
;

DROP POLICY IF EXISTS 'Users update own profile' ON public."profiles";
CREATE POLICY 'Users update own profile'
  ON public."profiles"
  AS PERMISSIVE
  FOR UPDATE
  USING ((id = auth.uid()))
  WITH CHECK ((id = auth.uid()))
;

DROP POLICY IF EXISTS 'Users view own profile' ON public."profiles";
CREATE POLICY 'Users view own profile'
  ON public."profiles"
  AS PERMISSIVE
  FOR SELECT
  USING ((id = auth.uid()))
;

DROP POLICY IF EXISTS 'Eleves view own profil' ON public."profils_eleves";
CREATE POLICY 'Eleves view own profil'
  ON public."profils_eleves"
  AS PERMISSIVE
  FOR SELECT
  USING ((eleve_id = auth.uid()))
;

DROP POLICY IF EXISTS 'Formateurs view student profils' ON public."profils_eleves";
CREATE POLICY 'Formateurs view student profils'
  ON public."profils_eleves"
  AS PERMISSIVE
  FOR SELECT
  USING ((eleve_id IN ( SELECT gm.eleve_id
   FROM (group_members gm
     JOIN groups g ON ((g.id = gm.group_id)))
  WHERE (g.formateur_id = auth.uid()))))
;

DROP POLICY IF EXISTS 'formateur_resource_assignments' ON public."resource_assignments";
CREATE POLICY 'formateur_resource_assignments'
  ON public."resource_assignments"
  AS PERMISSIVE
  FOR ALL
  USING ((assigned_by = auth.uid()))
  WITH CHECK ((assigned_by = auth.uid()))
;

DROP POLICY IF EXISTS 'learner_view_resource_assignments' ON public."resource_assignments";
CREATE POLICY 'learner_view_resource_assignments'
  ON public."resource_assignments"
  AS PERMISSIVE
  FOR SELECT
  USING ((learner_id = auth.uid()))
;

DROP POLICY IF EXISTS 'Eleves view own resultats' ON public."resultats";
CREATE POLICY 'Eleves view own resultats'
  ON public."resultats"
  AS PERMISSIVE
  FOR SELECT
  USING ((eleve_id = auth.uid()))
;

DROP POLICY IF EXISTS 'Formateurs view student resultats' ON public."resultats";
CREATE POLICY 'Formateurs view student resultats'
  ON public."resultats"
  AS PERMISSIVE
  FOR SELECT
  USING ((eleve_id IN ( SELECT gm.eleve_id
   FROM (group_members gm
     JOIN groups g ON ((g.id = gm.group_id)))
  WHERE (g.formateur_id = auth.uid()))))
;

DROP POLICY IF EXISTS 'Formateur voit uniquement son sandbox' ON public."sandbox_sessions";
CREATE POLICY 'Formateur voit uniquement son sandbox'
  ON public."sandbox_sessions"
  AS PERMISSIVE
  FOR ALL
  USING ((formateur_id = auth.uid()))
  WITH CHECK ((formateur_id = auth.uid()))
;

DROP POLICY IF EXISTS 'Formateurs manage own sequences' ON public."sequences_pedagogiques";
CREATE POLICY 'Formateurs manage own sequences'
  ON public."sequences_pedagogiques"
  AS PERMISSIVE
  FOR ALL
  USING ((formateur_id = auth.uid()))
  WITH CHECK ((formateur_id = auth.uid()))
;

DROP POLICY IF EXISTS 'Acces session_blocks formateur' ON public."session_blocks";
CREATE POLICY 'Acces session_blocks formateur'
  ON public."session_blocks"
  AS PERMISSIVE
  FOR ALL
  USING ((get_session_formateur(session_id) = auth.uid()))
  WITH CHECK ((get_session_formateur(session_id) = auth.uid()))
;

DROP POLICY IF EXISTS 'Eleves view session_exercices_secure' ON public."session_exercices";
CREATE POLICY 'Eleves view session_exercices_secure'
  ON public."session_exercices"
  AS PERMISSIVE
  FOR SELECT
  USING (((EXISTS ( SELECT 1
   FROM (sessions s
     JOIN group_members gm ON ((gm.group_id = s.group_id)))
  WHERE ((s.id = session_exercices.session_id) AND (gm.eleve_id = auth.uid())))) AND ((eleve_id IS NULL) OR (eleve_id = auth.uid()))))
;

DROP POLICY IF EXISTS 'Formateurs manage session_exercices' ON public."session_exercices";
CREATE POLICY 'Formateurs manage session_exercices'
  ON public."session_exercices"
  AS PERMISSIVE
  FOR ALL
  USING ((get_session_formateur(session_id) = auth.uid()))
  WITH CHECK ((get_session_formateur(session_id) = auth.uid()))
;

DROP POLICY IF EXISTS 'Eleves view own session exercise variants' ON public."session_exercise_variants";
CREATE POLICY 'Eleves view own session exercise variants'
  ON public."session_exercise_variants"
  AS PERMISSIVE
  FOR SELECT
  USING ((eleve_id = auth.uid()))
;

DROP POLICY IF EXISTS 'Formateurs manage session exercise variants' ON public."session_exercise_variants";
CREATE POLICY 'Formateurs manage session exercise variants'
  ON public."session_exercise_variants"
  AS PERMISSIVE
  FOR ALL
  USING ((get_session_formateur(session_id) = auth.uid()))
  WITH CHECK ((get_session_formateur(session_id) = auth.uid()))
;

DROP POLICY IF EXISTS 'Eleves view their sessions' ON public."sessions";
CREATE POLICY 'Eleves view their sessions'
  ON public."sessions"
  AS PERMISSIVE
  FOR SELECT
  USING ((group_id IN ( SELECT group_members.group_id
   FROM group_members
  WHERE (group_members.eleve_id = auth.uid()))))
;

DROP POLICY IF EXISTS 'Formateurs manage sessions' ON public."sessions";
CREATE POLICY 'Formateurs manage sessions'
  ON public."sessions"
  AS PERMISSIVE
  FOR ALL
  USING ((get_group_formateur(group_id) = auth.uid()))
  WITH CHECK ((get_group_formateur(group_id) = auth.uid()))
;

DROP POLICY IF EXISTS 'Eleves insert own levels' ON public."student_competency_levels";
CREATE POLICY 'Eleves insert own levels'
  ON public."student_competency_levels"
  AS PERMISSIVE
  FOR INSERT
  WITH CHECK ((eleve_id = auth.uid()))
;

DROP POLICY IF EXISTS 'Eleves view own levels' ON public."student_competency_levels";
CREATE POLICY 'Eleves view own levels'
  ON public."student_competency_levels"
  AS PERMISSIVE
  FOR SELECT
  USING ((eleve_id = auth.uid()))
;

DROP POLICY IF EXISTS 'Formateurs manage student levels' ON public."student_competency_levels";
CREATE POLICY 'Formateurs manage student levels'
  ON public."student_competency_levels"
  AS PERMISSIVE
  FOR ALL
  USING ((eleve_id IN ( SELECT gm.eleve_id
   FROM (group_members gm
     JOIN groups g ON ((g.id = gm.group_id)))
  WHERE (g.formateur_id = auth.uid()))))
  WITH CHECK ((eleve_id IN ( SELECT gm.eleve_id
   FROM (group_members gm
     JOIN groups g ON ((g.id = gm.group_id)))
  WHERE (g.formateur_id = auth.uid()))))
;

DROP POLICY IF EXISTS 'Formateurs view student levels' ON public."student_competency_levels";
CREATE POLICY 'Formateurs view student levels'
  ON public."student_competency_levels"
  AS PERMISSIVE
  FOR SELECT
  USING ((eleve_id IN ( SELECT gm.eleve_id
   FROM (group_members gm
     JOIN groups g ON ((g.id = gm.group_id)))
  WHERE (g.formateur_id = auth.uid()))))
;

DROP POLICY IF EXISTS 'Eleves manage own competency' ON public."student_competency_status";
CREATE POLICY 'Eleves manage own competency'
  ON public."student_competency_status"
  AS PERMISSIVE
  FOR ALL
  USING ((eleve_id = auth.uid()))
  WITH CHECK ((eleve_id = auth.uid()))
;

DROP POLICY IF EXISTS 'Eleves view own competency' ON public."student_competency_status";
CREATE POLICY 'Eleves view own competency'
  ON public."student_competency_status"
  AS PERMISSIVE
  FOR SELECT
  USING ((eleve_id = auth.uid()))
;

DROP POLICY IF EXISTS 'Formateurs view student competency' ON public."student_competency_status";
CREATE POLICY 'Formateurs view student competency'
  ON public."student_competency_status"
  AS PERMISSIVE
  FOR SELECT
  USING ((eleve_id IN ( SELECT gm.eleve_id
   FROM (group_members gm
     JOIN groups g ON ((g.id = gm.group_id)))
  WHERE (g.formateur_id = auth.uid()))))
;

DROP POLICY IF EXISTS 'students_delete_own_vocabulary' ON public."student_vocabulary";
CREATE POLICY 'students_delete_own_vocabulary'
  ON public."student_vocabulary"
  AS PERMISSIVE
  FOR DELETE
  USING ((auth.uid() = student_id))
;

DROP POLICY IF EXISTS 'students_insert_own_vocabulary' ON public."student_vocabulary";
CREATE POLICY 'students_insert_own_vocabulary'
  ON public."student_vocabulary"
  AS PERMISSIVE
  FOR INSERT
  WITH CHECK ((auth.uid() = student_id))
;

DROP POLICY IF EXISTS 'students_read_own_vocabulary' ON public."student_vocabulary";
CREATE POLICY 'students_read_own_vocabulary'
  ON public."student_vocabulary"
  AS PERMISSIVE
  FOR SELECT
  USING ((auth.uid() = student_id))
;

DROP POLICY IF EXISTS 'students_update_own_vocabulary' ON public."student_vocabulary";
CREATE POLICY 'students_update_own_vocabulary'
  ON public."student_vocabulary"
  AS PERMISSIVE
  FOR UPDATE
  USING ((auth.uid() = student_id))
  WITH CHECK ((auth.uid() = student_id))
;

DROP POLICY IF EXISTS 'Eleves insert own resultats_apprenants' ON public."test_resultats_apprenants";
CREATE POLICY 'Eleves insert own resultats_apprenants'
  ON public."test_resultats_apprenants"
  AS PERMISSIVE
  FOR INSERT
  WITH CHECK ((apprenant_id = auth.uid()))
;

DROP POLICY IF EXISTS 'Eleves view own resultats_apprenants' ON public."test_resultats_apprenants";
CREATE POLICY 'Eleves view own resultats_apprenants'
  ON public."test_resultats_apprenants"
  AS PERMISSIVE
  FOR SELECT
  USING ((apprenant_id = auth.uid()))
;

DROP POLICY IF EXISTS 'Formateurs update resultats_apprenants' ON public."test_resultats_apprenants";
CREATE POLICY 'Formateurs update resultats_apprenants'
  ON public."test_resultats_apprenants"
  AS PERMISSIVE
  FOR UPDATE
  USING ((apprenant_id IN ( SELECT gm.eleve_id
   FROM (group_members gm
     JOIN groups g ON ((g.id = gm.group_id)))
  WHERE (g.formateur_id = auth.uid()))))
  WITH CHECK ((apprenant_id IN ( SELECT gm.eleve_id
   FROM (group_members gm
     JOIN groups g ON ((g.id = gm.group_id)))
  WHERE (g.formateur_id = auth.uid()))))
;

DROP POLICY IF EXISTS 'Formateurs view student resultats_apprenants' ON public."test_resultats_apprenants";
CREATE POLICY 'Formateurs view student resultats_apprenants'
  ON public."test_resultats_apprenants"
  AS PERMISSIVE
  FOR SELECT
  USING ((apprenant_id IN ( SELECT gm.eleve_id
   FROM (group_members gm
     JOIN groups g ON ((g.id = gm.group_id)))
  WHERE (g.formateur_id = auth.uid()))))
;

DROP POLICY IF EXISTS 'Eleves insert own tests_entree' ON public."tests_entree";
CREATE POLICY 'Eleves insert own tests_entree'
  ON public."tests_entree"
  AS PERMISSIVE
  FOR INSERT
  WITH CHECK ((eleve_id = auth.uid()))
;

DROP POLICY IF EXISTS 'Eleves update own tests_entree' ON public."tests_entree";
CREATE POLICY 'Eleves update own tests_entree'
  ON public."tests_entree"
  AS PERMISSIVE
  FOR UPDATE
  USING ((eleve_id = auth.uid()))
  WITH CHECK ((eleve_id = auth.uid()))
;

DROP POLICY IF EXISTS 'Eleves view own tests_entree' ON public."tests_entree";
CREATE POLICY 'Eleves view own tests_entree'
  ON public."tests_entree"
  AS PERMISSIVE
  FOR SELECT
  USING ((eleve_id = auth.uid()))
;

DROP POLICY IF EXISTS 'Formateurs view student tests' ON public."tests_entree";
CREATE POLICY 'Formateurs view student tests'
  ON public."tests_entree"
  AS PERMISSIVE
  FOR SELECT
  USING ((eleve_id IN ( SELECT gm.eleve_id
   FROM (group_members gm
     JOIN groups g ON ((g.id = gm.group_id)))
  WHERE (g.formateur_id = auth.uid()))))
;

DROP POLICY IF EXISTS 'Users view own roles' ON public."user_roles";
CREATE POLICY 'Users view own roles'
  ON public."user_roles"
  AS PERMISSIVE
  FOR SELECT
  USING ((user_id = auth.uid()))
;
