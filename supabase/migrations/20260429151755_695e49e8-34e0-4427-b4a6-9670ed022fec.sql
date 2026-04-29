-- Révoquer EXECUTE sur les fonctions guard_* — elles ne doivent JAMAIS être
-- appelées en RPC, uniquement par les triggers internes.
REVOKE EXECUTE ON FUNCTION public.guard_exercise_attempts_eleve_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_devoirs_eleve_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_test_sessions_eleve_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_test_reponses_eleve_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_tests_entree_eleve_update() FROM PUBLIC, anon, authenticated;
