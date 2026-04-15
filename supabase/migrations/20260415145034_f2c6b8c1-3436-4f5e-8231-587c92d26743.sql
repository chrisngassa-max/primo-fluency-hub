
CREATE POLICY "eleves_view_session_exercices_content"
ON public.exercices
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM session_exercices se
    JOIN sessions s ON s.id = se.session_id
    JOIN group_members gm ON gm.group_id = s.group_id
    WHERE se.exercice_id = exercices.id
      AND se.statut = 'traite_en_classe'
      AND gm.eleve_id = auth.uid()
  )
);
