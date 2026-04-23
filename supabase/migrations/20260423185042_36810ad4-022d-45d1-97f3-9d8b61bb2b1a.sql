ALTER TABLE public.external_resource_results REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.external_resource_results;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END$$;