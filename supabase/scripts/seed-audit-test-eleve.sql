-- CapTCF audit test account: test.audit.eleve2@gmail.com / 113test
-- Formateur: livelec@yahoo.fr
-- Run manually with service-role access (Supabase SQL editor or CLI).
-- Idempotent: safe to re-run.

DO $$
DECLARE
  v_formateur_id uuid;
  v_eleve_id uuid;
  v_group_id uuid;
  v_email text := 'test.audit.eleve2@gmail.com';
  v_password text := '113test';
BEGIN
  SELECT id INTO v_formateur_id FROM public.profiles WHERE email = 'livelec@yahoo.fr' LIMIT 1;
  IF v_formateur_id IS NULL THEN
    RAISE EXCEPTION 'Formateur livelec@yahoo.fr introuvable';
  END IF;

  SELECT id INTO v_eleve_id FROM auth.users WHERE email = v_email LIMIT 1;

  IF v_eleve_id IS NULL THEN
    v_eleve_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) VALUES (
      v_eleve_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      v_email,
      crypt(v_password, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('nom', 'Audit', 'prenom', 'Eleve2', 'role', 'eleve'),
      now(),
      now(),
      '', '', '', ''
    );
    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_eleve_id,
      v_eleve_id,
      jsonb_build_object('sub', v_eleve_id::text, 'email', v_email),
      'email',
      v_eleve_id::text,
      now(),
      now(),
      now()
    );
  ELSE
    UPDATE auth.users
    SET encrypted_password = crypt(v_password, gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        raw_user_meta_data = jsonb_build_object('nom', 'Audit', 'prenom', 'Eleve2', 'role', 'eleve')
    WHERE id = v_eleve_id;
  END IF;

  INSERT INTO public.profiles (id, email, nom, prenom, status)
  VALUES (v_eleve_id, v_email, 'Audit', 'Eleve2', 'approved')
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        nom = EXCLUDED.nom,
        prenom = EXCLUDED.prenom,
        status = 'approved';

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_eleve_id, 'eleve')
  ON CONFLICT (user_id) DO UPDATE SET role = 'eleve';

  INSERT INTO public.ai_processing_consents (
    user_id, consent_ai, consent_biometric, consented_at, revoked_at, version, source
  ) VALUES (
    v_eleve_id, true, true, now(), NULL, 'v1.0', 'audit_seed'
  )
  ON CONFLICT (user_id) DO UPDATE
    SET consent_ai = true,
        consent_biometric = true,
        consented_at = now(),
        revoked_at = NULL,
        version = 'v1.0',
        source = 'audit_seed';

  SELECT g.id INTO v_group_id
  FROM public.groups g
  WHERE g.formateur_id = v_formateur_id
  ORDER BY g.created_at ASC
  LIMIT 1;

  IF v_group_id IS NULL THEN
    INSERT INTO public.groups (formateur_id, nom, niveau_cible)
    VALUES (v_formateur_id, 'Groupe audit CapTCF', 'B1')
    RETURNING id INTO v_group_id;
  END IF;

  INSERT INTO public.group_members (group_id, eleve_id)
  VALUES (v_group_id, v_eleve_id)
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Audit eleve % provisioned in group % for formateur %', v_email, v_group_id, v_formateur_id;
END $$;
