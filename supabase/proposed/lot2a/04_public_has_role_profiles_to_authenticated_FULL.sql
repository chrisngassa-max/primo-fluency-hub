-- =============================================================================
-- CAPTCF LOT 2A — PROPOSED (NOT APPLIED) — B3 has_role-dependent {public} → TO authenticated
-- Generated from CAPTCF_LOT_02A_POLICIES_INVENTORY.json
-- Count: 3
-- Target role clause: TO authenticated
-- DO NOT place under supabase/migrations/ until owner-authorized.
-- =============================================================================
-- Only the 3 profiles policies still on {public} with has_role. Coordinate with has_role Edge fix.

-- class=dependante_has_role table=profiles
DROP POLICY IF EXISTS 'Admins view all profiles' ON public."profiles";
CREATE POLICY 'Admins view all profiles'
  ON public."profiles"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
;

-- class=dependante_has_role table=profiles
DROP POLICY IF EXISTS 'Formateurs view own invited pending students' ON public."profiles";
CREATE POLICY 'Formateurs view own invited pending students'
  ON public."profiles"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (((status = 'pending'::text) AND has_role(auth.uid(), 'formateur'::app_role) AND (EXISTS ( SELECT 1
   FROM group_invitations gi
  WHERE ((gi.created_by = auth.uid()) AND (gi.expires_at > now())))) AND (EXISTS ( SELECT 1
   FROM (group_members gm
     JOIN groups g ON ((g.id = gm.group_id)))
  WHERE ((gm.eleve_id = profiles.id) AND (g.formateur_id = auth.uid()))))))
;

-- class=dependante_has_role table=profiles
DROP POLICY IF EXISTS 'Formateurs view their students' ON public."profiles";
CREATE POLICY 'Formateurs view their students'
  ON public."profiles"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING ((has_role(auth.uid(), 'formateur'::app_role) AND (id IN ( SELECT gm.eleve_id
   FROM (group_members gm
     JOIN groups g ON ((g.id = gm.group_id)))
  WHERE (g.formateur_id = auth.uid())))))
;

SELECT 'lot2a_proposed_04_public_has_role_profiles_to_authenticated_FULL.sql_ready'::text AS status;