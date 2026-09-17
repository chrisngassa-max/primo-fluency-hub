-- CAPTCF Lot 1 fixture snippet (NOT a real migration).
-- Used by self-test to verify detection of CREATE TABLE without REVOKE/GRANT/TO.
-- Do not apply. No PII.

CREATE TABLE public.lot01_fixture_bad_table (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text
);

ALTER TABLE public.lot01_fixture_bad_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone read" ON public.lot01_fixture_bad_table
  FOR SELECT
  USING (true);
