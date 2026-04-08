
-- 1. Fix student_competency_levels: remove ALL policy for students, replace with INSERT-only
DROP POLICY IF EXISTS "Eleves manage own levels" ON public.student_competency_levels;

CREATE POLICY "Eleves insert own levels"
ON public.student_competency_levels
FOR INSERT
TO public
WITH CHECK (eleve_id = auth.uid());

-- 2. Fix group_invitations: restrict broad SELECT to server-side only
DROP POLICY IF EXISTS "Auth users read invitations by code" ON public.group_invitations;

-- 3. Fix profils_eleves: remove ALL policy for students, keep SELECT only
DROP POLICY IF EXISTS "Eleves manage own profil" ON public.profils_eleves;
