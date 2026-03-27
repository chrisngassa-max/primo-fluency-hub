
-- Finalize the in-progress test session with simulated EO/EE scores
UPDATE public.test_sessions
SET statut = 'termine',
    date_fin = now(),
    score_eo = 3,
    score_ee = 3,
    palier_eo = 1,
    palier_ee = 1,
    profil_final = 'A0_intermediaire',
    groupe_suggere = 'groupe_1'
WHERE id = '5f362aba-5f6b-4a9f-95b9-b4539a7e5c14'
  AND statut = 'en_cours';

-- Insert the test result row
INSERT INTO public.test_resultats_apprenants (
    apprenant_id, session_id, score_total,
    score_co, score_ce, score_eo, score_ee,
    palier_final_co, palier_final_ce, palier_final_eo, palier_final_ee,
    profil, groupe_suggere
) VALUES (
    '573283b7-85a8-45b5-a102-de93bcb98e0e',
    '5f362aba-5f6b-4a9f-95b9-b4539a7e5c14',
    13, 7, 0, 3, 3,
    3, 1, 1, 1,
    'A0_intermediaire', 'groupe_1'
);
