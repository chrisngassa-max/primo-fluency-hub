-- Passwords are managed by Supabase Auth and must never be stored in profiles.
UPDATE public.profiles
SET mot_de_passe_initial = NULL
WHERE mot_de_passe_initial IS NOT NULL;
