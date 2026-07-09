-- ============================================================
-- CapTCF - Lot C : insertion riche dans le deroule de seance
-- Ajout des types audio/video aux liens de documents de seance.
-- Pas de nouvelle table : on reutilise session_document_links.
-- ============================================================

BEGIN;

ALTER TABLE public.session_document_links
  DROP CONSTRAINT IF EXISTS session_document_links_linked_type_check;
ALTER TABLE public.session_document_links
  ADD CONSTRAINT session_document_links_linked_type_check CHECK (linked_type IN (
    'exercise', 'pdf', 'docx', 'image', 'audio', 'video', 'html', 'note', 'generated_document'
  ));

ALTER TABLE public.session_document_links
  DROP CONSTRAINT IF EXISTS session_document_links_implemented_types;
ALTER TABLE public.session_document_links
  ADD CONSTRAINT session_document_links_implemented_types CHECK (linked_type IN (
    'exercise', 'pdf', 'docx', 'image', 'audio', 'video'
  ));

COMMIT;
