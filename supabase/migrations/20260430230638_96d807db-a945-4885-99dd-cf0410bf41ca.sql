ALTER TABLE public.session_student_outcomes
  ADD CONSTRAINT sso_session_id_fkey
    FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE,
  ADD CONSTRAINT sso_eleve_id_fkey
    FOREIGN KEY (eleve_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD CONSTRAINT sso_formateur_id_fkey
    FOREIGN KEY (formateur_id) REFERENCES public.profiles(id) ON DELETE CASCADE;