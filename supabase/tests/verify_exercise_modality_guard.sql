select
  public.exercise_modality_issues(
    'Test',
    'Écoutez puis répondez',
    'CO',
    'qcm',
    '{"items":[{"question":"Qui parle ?"}]}'::jsonb
  ) as invalid_co,
  public.exercise_modality_issues(
    'Test',
    'Enregistrez votre réponse',
    'EO',
    'production_orale',
    '{}'::jsonb
  ) as valid_eo;
