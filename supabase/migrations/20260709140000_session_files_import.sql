-- ============================================================
-- CapTCF — Lot 4 "Documents de séance" : import de fichiers
-- (PDF/DOCX/image) dans "Ressources à classer", liés via
-- session_document_links comme les exercices du Lot 3. Additive.
-- S01 uniquement pour l'instant.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. session_document_links.linked_id référençait exclusivement
-- exercices(id) (FK du Lot 3, ON DELETE CASCADE). Un fichier importé
-- n'a pas de ligne exercices correspondante : linked_id devient un
-- uuid synthétique généré côté client, la vraie référence (chemin
-- Storage) vit dans metadata. On remplace la FK inconditionnelle par
-- une validation conditionnelle (déclencheur), qui ne s'applique
-- qu'aux liens linked_type='exercise', et on réplique par un second
-- déclencheur le ON DELETE CASCADE perdu (exercice supprimé de la
-- banque -> ses liens de séance disparaissent aussi).
-- ------------------------------------------------------------
ALTER TABLE public.session_document_links
  DROP CONSTRAINT IF EXISTS session_document_links_linked_id_fkey;

CREATE OR REPLACE FUNCTION public.validate_session_document_link()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.linked_type = 'exercise' THEN
    IF NOT EXISTS (SELECT 1 FROM public.exercices WHERE id = NEW.linked_id) THEN
      RAISE EXCEPTION 'session_document_links.linked_id % does not reference an existing exercice', NEW.linked_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_session_document_link ON public.session_document_links;
CREATE TRIGGER trg_validate_session_document_link
  BEFORE INSERT OR UPDATE ON public.session_document_links
  FOR EACH ROW EXECUTE FUNCTION public.validate_session_document_link();

CREATE OR REPLACE FUNCTION public.cascade_delete_exercise_links()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.session_document_links
  WHERE linked_type = 'exercise' AND linked_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cascade_delete_exercise_links ON public.exercices;
CREATE TRIGGER trg_cascade_delete_exercise_links
  AFTER DELETE ON public.exercices
  FOR EACH ROW EXECUTE FUNCTION public.cascade_delete_exercise_links();

-- ------------------------------------------------------------
-- 2. Types de liens implémentés : Lot 3 n'autorisait que 'exercise'.
-- Lot 4 ajoute pdf/docx/image (fichiers importés). html/note/
-- generated_document restent réservés à de futurs lots, non actifs.
-- 'image' n'existait pas non plus dans le CHECK de base (Lot 3).
-- ------------------------------------------------------------
ALTER TABLE public.session_document_links
  DROP CONSTRAINT IF EXISTS session_document_links_linked_type_check;
ALTER TABLE public.session_document_links
  ADD CONSTRAINT session_document_links_linked_type_check CHECK (linked_type IN (
    'exercise', 'pdf', 'docx', 'image', 'html', 'note', 'generated_document'
  ));

ALTER TABLE public.session_document_links
  DROP CONSTRAINT IF EXISTS session_document_links_only_exercise_for_now;
ALTER TABLE public.session_document_links
  ADD CONSTRAINT session_document_links_implemented_types CHECK (linked_type IN (
    'exercise', 'pdf', 'docx', 'image'
  ));

-- ------------------------------------------------------------
-- 3. Bucket Storage privé pour les fichiers importés. Chemin
-- conventionnel : <session_code>/<uuid>-<nom_fichier>. Accès
-- formateur/admin uniquement (has_role), aucune policy élève :
-- les ressources en "Ressources à classer" restent des brouillons.
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('session-documents', 'session-documents', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "staff_upload_session_documents_storage" ON storage.objects;
CREATE POLICY "staff_upload_session_documents_storage"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'session-documents'
    AND (
      public.has_role(auth.uid(), 'formateur'::public.app_role)
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  );

DROP POLICY IF EXISTS "staff_read_session_documents_storage" ON storage.objects;
CREATE POLICY "staff_read_session_documents_storage"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'session-documents'
    AND (
      public.has_role(auth.uid(), 'formateur'::public.app_role)
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  );

DROP POLICY IF EXISTS "staff_delete_session_documents_storage" ON storage.objects;
CREATE POLICY "staff_delete_session_documents_storage"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'session-documents'
    AND (
      public.has_role(auth.uid(), 'formateur'::public.app_role)
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  );

COMMIT;
