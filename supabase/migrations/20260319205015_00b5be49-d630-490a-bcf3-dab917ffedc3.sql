
-- Table for group invitation codes
CREATE TABLE public.group_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '7 days'),
  used_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.group_invitations ENABLE ROW LEVEL SECURITY;

-- Formateurs can manage invitations for their own groups
CREATE POLICY "Formateurs manage own invitations"
ON public.group_invitations
FOR ALL
USING (get_group_formateur(group_id) = auth.uid())
WITH CHECK (get_group_formateur(group_id) = auth.uid());

-- Authenticated users can read invitations (to join via code)
CREATE POLICY "Auth users read invitations by code"
ON public.group_invitations
FOR SELECT
TO authenticated
USING (true);
