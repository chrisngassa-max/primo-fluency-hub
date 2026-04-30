-- RGPD: AI processing consents and audit logs

CREATE TABLE IF NOT EXISTS public.ai_processing_consents (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_ai boolean NOT NULL DEFAULT false,
  consent_biometric boolean NOT NULL DEFAULT false,
  consented_at timestamptz,
  revoked_at timestamptz,
  version text NOT NULL DEFAULT 'v1.0',
  source text,
  reminder_count integer NOT NULL DEFAULT 0,
  last_reminded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_processing_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users select own consent"
  ON public.ai_processing_consents FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "users insert own consent"
  ON public.ai_processing_consents FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users update own consent"
  ON public.ai_processing_consents FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.touch_ai_consent_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ai_consent_updated_at
  BEFORE UPDATE ON public.ai_processing_consents
  FOR EACH ROW EXECUTE FUNCTION public.touch_ai_consent_updated_at();

-- AI processing logs (no raw content)
CREATE TABLE IF NOT EXISTS public.ai_processing_logs (
  id bigserial PRIMARY KEY,
  subject_user_id uuid,
  triggered_by_user_id uuid,
  function_name text NOT NULL,
  provider text,
  model text,
  data_categories text[] DEFAULT '{}',
  pseudonymization_level text,
  status text,
  duration_ms integer,
  consent_version text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_logs_subject ON public.ai_processing_logs(subject_user_id, created_at DESC);

ALTER TABLE public.ai_processing_logs ENABLE ROW LEVEL SECURITY;

-- Only service_role can write; users can read their own
CREATE POLICY "users read own ai logs"
  ON public.ai_processing_logs FOR SELECT
  USING (subject_user_id = auth.uid());

CREATE POLICY "service role inserts ai logs"
  ON public.ai_processing_logs FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Helper function: check consent (security definer to bypass RLS for edge functions if needed via service role)
CREATE OR REPLACE FUNCTION public.has_ai_consent(_user_id uuid, _require_biometric boolean DEFAULT false)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ai_processing_consents
    WHERE user_id = _user_id
      AND consent_ai = true
      AND (NOT _require_biometric OR consent_biometric = true)
      AND revoked_at IS NULL
  );
$$;