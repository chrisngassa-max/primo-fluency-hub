INSERT INTO public.user_roles (user_id, role)
VALUES ('82acac8e-8add-4f62-9cfd-701989a82bd9', 'formateur')
ON CONFLICT (user_id, role) DO NOTHING;