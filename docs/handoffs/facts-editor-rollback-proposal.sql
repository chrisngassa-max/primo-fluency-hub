-- RETOUR ARRIERE PROPOSE, NON EXECUTE. Desactiver l'editeur/Edge revise_facts avant.
-- Les corrections deja sauvegardees ne sont pas annulees ; ne jamais restaurer
-- automatiquement le hash refuse. Les donnees restent disponibles en draft.
BEGIN;
DROP TRIGGER IF EXISTS guard_studio_facts_confirmation ON public.pedagogical_sources;
DROP TRIGGER IF EXISTS guard_studio_fact_payload ON public.differentiation_families;
DROP FUNCTION IF EXISTS public.guard_studio_facts_confirmation();
DROP FUNCTION IF EXISTS public.guard_studio_fact_payload();
DROP FUNCTION IF EXISTS public.commit_studio_facts_revision(uuid,uuid,uuid,timestamptz,timestamptz,text,integer,jsonb,text);
-- Aucune table ni donnee supprimee ; aucune policy existante modifiee.
ROLLBACK;
