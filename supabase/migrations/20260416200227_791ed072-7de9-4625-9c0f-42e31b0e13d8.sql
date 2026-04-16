-- Smoke test: activate one exercise as live + clean up test attempts
UPDATE public.exercices
SET is_live_ready = true
WHERE id = 'bbcbcbbf-0ce3-4922-bdbf-5026eafb7f5f';

-- Remove the test attempt created during smoke testing
DELETE FROM public.exercise_attempts
WHERE exercise_id = 'bbcbcbbf-0ce3-4922-bdbf-5026eafb7f5f'
  AND score_normalized = 0
  AND answers::text LIKE '%"reponse":"x"%';