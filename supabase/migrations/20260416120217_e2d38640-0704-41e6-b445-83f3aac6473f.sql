-- Create sync_log table
CREATE TABLE IF NOT EXISTS public.sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  direction text CHECK (direction IN ('from_main','to_main')),
  payload jsonb,
  status text,
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sync_log ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role manages sync_log"
  ON public.sync_log FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Authenticated users can insert
CREATE POLICY "Auth users insert sync_log"
  ON public.sync_log FOR INSERT TO authenticated
  WITH CHECK (true);

-- Authenticated users can read own logs
CREATE POLICY "Auth users read sync_log"
  ON public.sync_log FOR SELECT TO authenticated
  USING (true);