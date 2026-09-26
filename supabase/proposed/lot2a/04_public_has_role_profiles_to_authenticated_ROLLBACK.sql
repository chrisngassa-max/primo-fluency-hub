-- ROLLBACK proposed for B3 — restore TO public (default)
-- Count: 3

DROP POLICY IF EXISTS 'Admins view all profiles' ON public."profiles";
CREATE POLICY 'Admins view all profiles'
  ON public."profiles"
  AS PERMISSIVE
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role))
;

DROP POLICY IF EXISTS 'Formateurs view own invited pending students' ON public."profiles";
CREATE POLICY 'Formateurs view own invited pending students'
  ON public."profiles"
  AS PERMISSIVE
  FOR SELECT
  USING (((status = 'pending'::text) AND has_role(auth.uid(), 'formateur'::app_role) AND (EXISTS ( SELECT 1
   FROM group_invitations gi
  WHERE ((gi.created_by = auth.uid()) AND (gi.expires_at > now())))) AND (EXISTS ( SELECT 1
   FROM (group_members gm
     JOIN groups g ON ((g.id = gm.group_id)))
  WHERE ((gm.eleve_id = profiles.id) AND (g.formateur_id = auth.uid()))))))
;

DROP POLICY IF EXISTS 'Formateurs view their students' ON public."profiles";
CREATE POLICY 'Formateurs view their students'
  ON public."profiles"
  AS PERMISSIVE
  FOR SELECT
  USING ((has_role(auth.uid(), 'formateur'::app_role) AND (id IN ( SELECT gm.eleve_id
   FROM (group_members gm
     JOIN groups g ON ((g.id = gm.group_id)))
  WHERE (g.formateur_id = auth.uid())))))
;
