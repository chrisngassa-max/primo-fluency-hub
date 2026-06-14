-- B12: Allow students to notify their group formateur (e.g. devoir submitted).
-- B9 devoir auto-creation is handled server-side in submit-devoir-result (service role).

-- ── B12: student → formateur bilan_post_devoirs INSERT ──────────────────────
-- DevoirPassation saves the AI bilan before notifying the formateur.
DROP POLICY IF EXISTS "Eleves create bilan for their formateur" ON public.bilan_post_devoirs;
CREATE POLICY "Eleves create bilan for their formateur"
  ON public.bilan_post_devoirs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    eleve_id = auth.uid()
    AND formateur_id IN (
      SELECT g.formateur_id FROM public.group_members gm
      JOIN public.groups g ON g.id = gm.group_id
      WHERE gm.eleve_id = auth.uid()
    )
  );

-- ── B12: student → formateur notification INSERT ────────────────────────────
DROP POLICY IF EXISTS "Eleves notify their formateurs" ON public.notifications;
CREATE POLICY "Eleves notify their formateurs"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id IN (
      SELECT g.formateur_id FROM public.group_members gm
      JOIN public.groups g ON g.id = gm.group_id
      WHERE gm.eleve_id = auth.uid()
    )
  );
