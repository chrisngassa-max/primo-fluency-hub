
-- Add status column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

-- Set all existing profiles to 'approved' so current users aren't locked out
UPDATE public.profiles SET status = 'approved' WHERE status = 'pending';

-- Allow formateurs to see pending student profiles
CREATE POLICY "Formateurs view pending students"
ON public.profiles
FOR SELECT
TO public
USING (
  status = 'pending' 
  AND has_role(auth.uid(), 'formateur'::app_role)
);
