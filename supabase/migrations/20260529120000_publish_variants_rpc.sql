-- Auto-publication atomique d'un run de variantes pour une session.
-- L'ordre des UPDATE (désactiver les anciens runs AVANT d'activer le nouveau)
-- garantit qu'aucun couple (session_id, eleve_id, exercice_index) n'a deux
-- lignes is_active = true simultanément, donc l'index unique partiel
-- idx_session_exercise_variants_active n'est jamais violé.
CREATE OR REPLACE FUNCTION public.publish_session_variants_run(
  p_session_id uuid,
  p_generation_run_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Désactiver tous les runs précédents pour cette session (AVANT d'activer le nouveau)
  UPDATE public.session_exercise_variants
  SET is_active = false
  WHERE session_id = p_session_id
    AND generation_run_id <> p_generation_run_id
    AND is_active = true;

  -- 2. Activer le run courant
  UPDATE public.session_exercise_variants
  SET is_active = true
  WHERE session_id = p_session_id
    AND generation_run_id = p_generation_run_id
    AND is_active = false;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_session_variants_run(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_session_variants_run(uuid, uuid) TO authenticated;
