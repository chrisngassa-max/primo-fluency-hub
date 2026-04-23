UPDATE auth.users
SET 
  encrypted_password = crypt('Douala120279!!!', gen_salt('bf')),
  updated_at = now()
WHERE email = 'livelec@yahoo.fr';

UPDATE public.profiles
SET mot_de_passe_initial = 'Douala120279!!!', updated_at = now()
WHERE email = 'livelec@yahoo.fr';