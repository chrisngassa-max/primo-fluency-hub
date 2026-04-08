
-- 1. Remove plaintext password column from profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS mot_de_passe_initial;

-- 2. Fix test-audio storage policies: restrict to owner + formateur
DROP POLICY IF EXISTS "Auth users read own test audio" ON storage.objects;
DROP POLICY IF EXISTS "Auth users upload test audio" ON storage.objects;

CREATE POLICY "Students read own test audio"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'test-audio'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Formateurs read student test audio"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'test-audio'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT gm.eleve_id FROM public.group_members gm
    JOIN public.groups g ON g.id = gm.group_id
    WHERE g.formateur_id = auth.uid()
  )
);

CREATE POLICY "Students upload own test audio"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'test-audio'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Fix search_path on email queue functions
CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name text, payload jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_email(queue_name text, message_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN
  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
EXCEPTION WHEN undefined_table THEN
  BEGIN
    PERFORM pgmq.create(dlq_name);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  BEGIN
    PERFORM pgmq.delete(source_queue, message_id);
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer)
RETURNS TABLE(msg_id bigint, read_ct integer, message jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$$;
