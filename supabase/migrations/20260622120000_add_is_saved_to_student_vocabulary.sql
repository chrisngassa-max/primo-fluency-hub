-- Sépare le CACHE de définitions IA (is_saved=false, écrit par l'edge function
-- get-word-definition) du CARNET de l'élève (is_saved=true, mots ajoutés
-- volontairement via "Ajouter à mon carnet"). La page "Mon carnet de mots" ne
-- liste que les entrées is_saved=true.
ALTER TABLE public.student_vocabulary
ADD COLUMN IF NOT EXISTS is_saved boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.student_vocabulary.is_saved IS
'true = mot ajoute volontairement au carnet par l''eleve. false = entree de cache IA (get-word-definition).';

-- Évite les doublons de mots réellement enregistrés dans le carnet (par
-- langue de traduction). Le cache (is_saved=false) reste libre d''accumuler
-- plusieurs entrées (contextes différents) sans contrainte.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_student_vocabulary_saved
ON public.student_vocabulary(student_id, normalized_word, translation_language)
WHERE is_saved = true;

-- Accélère le filtrage du carnet.
CREATE INDEX IF NOT EXISTS idx_student_vocabulary_saved
ON public.student_vocabulary(student_id, created_at DESC)
WHERE is_saved = true;
