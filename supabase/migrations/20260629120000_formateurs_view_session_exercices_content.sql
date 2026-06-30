-- Les exercices repris depuis la banque partagee (search-first) peuvent appartenir
-- a un autre formateur. Une fois rattaches a une seance via session_exercices, le
-- formateur proprietaire de la seance doit pouvoir les lire pour les afficher dans
-- le Pilote de seance ("Exercices prevus"). Sans cette policy, les lignes existent
-- mais l'exercice imbrique revient NULL (RLS) et la carte s'affiche vide.
-- Symetrique de "eleves_view_session_exercices_content".
CREATE POLICY "formateurs_view_session_exercices_content"
ON public.exercices
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM session_exercices se
    JOIN sessions s ON s.id = se.session_id
    JOIN groups g ON g.id = s.group_id
    WHERE se.exercice_id = exercices.id
      AND g.formateur_id = auth.uid()
  )
);
