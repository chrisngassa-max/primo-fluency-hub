INSERT INTO storage.buckets (id, name, public)
VALUES ('bilans-pdf', 'bilans-pdf', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "formateurs upload own bilans-pdf"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'bilans-pdf' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "formateurs read own bilans-pdf"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'bilans-pdf' AND (storage.foldername(name))[1] = auth.uid()::text);