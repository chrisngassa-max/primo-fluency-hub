-- Restore profiles SELECT policies for formateurs/admins (missing on production).
-- Without these, joins group_members → profiles return null and student dropdowns stay empty.

CREATE POLICY "Formateurs view their students"
  ON public.profiles
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'formateur'::public.app_role)
    AND id IN (
      SELECT gm.eleve_id
      FROM public.group_members gm
      JOIN public.groups g ON g.id = gm.group_id
      WHERE g.formateur_id = auth.uid()
    )
  );

CREATE POLICY "Admins view all profiles"
  ON public.profiles
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Formateurs view own invited pending students"
  ON public.profiles
  FOR SELECT
  USING (
    status = 'pending'
    AND public.has_role(auth.uid(), 'formateur'::public.app_role)
    AND EXISTS (
      SELECT 1
      FROM public.group_invitations gi
      WHERE gi.created_by = auth.uid()
        AND gi.expires_at > now()
    )
    AND EXISTS (
      SELECT 1
      FROM public.group_members gm
      JOIN public.groups g ON g.id = gm.group_id
      WHERE gm.eleve_id = profiles.id
        AND g.formateur_id = auth.uid()
    )
  );
