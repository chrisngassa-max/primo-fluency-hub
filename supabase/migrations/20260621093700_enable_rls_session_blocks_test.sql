-- Security advisor fix: public.session_blocks_test had RLS DISABLED, exposing it via the anon/publishable key.
-- This table is a leftover/scratch copy of public.session_blocks and is NOT referenced anywhere in
-- application code (only present in the auto-generated src/integrations/supabase/types.ts).
-- Non-destructive remediation: enable Row Level Security with NO policies, which restricts access to
-- the service-role only. The table and its data are preserved.
ALTER TABLE public.session_blocks_test ENABLE ROW LEVEL SECURITY;
