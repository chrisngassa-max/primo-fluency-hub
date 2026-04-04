INSERT INTO storage.buckets (id, name, public) VALUES ('exercise-images', 'exercise-images', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Exercise images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'exercise-images');

CREATE POLICY "Service role can upload exercise images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'exercise-images');

CREATE POLICY "Service role can update exercise images" ON storage.objects FOR UPDATE USING (bucket_id = 'exercise-images');

CREATE POLICY "Service role can delete exercise images" ON storage.objects FOR DELETE USING (bucket_id = 'exercise-images');