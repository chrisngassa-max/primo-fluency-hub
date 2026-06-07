ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS nb_exercices_souhaite integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS nb_exercices_retrospective integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS duree_retrospective integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS nb_questions_diagnostic integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS competences_autorisees text[] NOT NULL DEFAULT ARRAY['CO', 'CE']::text[],
  ADD COLUMN IF NOT EXISTS difficulte_par_defaut integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS generation_automatique_activee boolean NOT NULL DEFAULT true;

ALTER TABLE public.sessions
  DROP CONSTRAINT IF EXISTS sessions_nb_exercices_souhaite_check,
  DROP CONSTRAINT IF EXISTS sessions_nb_exercices_retrospective_check,
  DROP CONSTRAINT IF EXISTS sessions_duree_retrospective_check,
  DROP CONSTRAINT IF EXISTS sessions_nb_questions_diagnostic_check,
  DROP CONSTRAINT IF EXISTS sessions_difficulte_par_defaut_check;

ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_nb_exercices_souhaite_check CHECK (nb_exercices_souhaite BETWEEN 1 AND 30),
  ADD CONSTRAINT sessions_nb_exercices_retrospective_check CHECK (nb_exercices_retrospective BETWEEN 1 AND 30),
  ADD CONSTRAINT sessions_duree_retrospective_check CHECK (duree_retrospective BETWEEN 1 AND 60),
  ADD CONSTRAINT sessions_nb_questions_diagnostic_check CHECK (nb_questions_diagnostic BETWEEN 5 AND 30),
  ADD CONSTRAINT sessions_difficulte_par_defaut_check CHECK (difficulte_par_defaut BETWEEN 1 AND 10);

ALTER TABLE public.session_exercices
  ADD COLUMN IF NOT EXISTS bloc text NOT NULL DEFAULT 'core';

ALTER TABLE public.session_exercices
  DROP CONSTRAINT IF EXISTS session_exercices_bloc_check;

ALTER TABLE public.session_exercices
  ADD CONSTRAINT session_exercices_bloc_check CHECK (bloc IN ('retrospective', 'core', 'bonus'));

ALTER TABLE public.session_exercices
  DROP CONSTRAINT IF EXISTS session_exercices_session_id_exercice_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS session_exercices_collective_unique
  ON public.session_exercices (session_id, exercice_id) WHERE eleve_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS session_exercices_individual_unique
  ON public.session_exercices (session_id, exercice_id, eleve_id) WHERE eleve_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.session_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  block_type text NOT NULL CHECK (block_type IN ('retrospective', 'diagnostic', 'core')),
  status text NOT NULL CHECK (status IN ('pending', 'generating', 'ready', 'failed')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, block_type)
);

ALTER TABLE public.session_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acces session_blocks formateur" ON public.session_blocks;
CREATE POLICY "Acces session_blocks formateur" ON public.session_blocks FOR ALL
  USING (public.get_session_formateur(session_id) = auth.uid())
  WITH CHECK (public.get_session_formateur(session_id) = auth.uid());

CREATE OR REPLACE FUNCTION public.claim_session_block(p_session_id uuid, p_block_type text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_claimed boolean := false;
BEGIN
  IF p_block_type NOT IN ('retrospective', 'diagnostic', 'core') THEN
    RAISE EXCEPTION 'Invalid session block type';
  END IF;
  INSERT INTO public.session_blocks (session_id, block_type, status, error_message, updated_at)
  VALUES (p_session_id, p_block_type, 'generating', NULL, now())
  ON CONFLICT (session_id, block_type) DO UPDATE
  SET status = 'generating', error_message = NULL, updated_at = now()
  WHERE session_blocks.status IN ('failed', 'pending')
     OR (session_blocks.status = 'generating' AND session_blocks.updated_at < now() - interval '5 minutes')
  RETURNING true INTO v_claimed;
  RETURN COALESCE(v_claimed, false);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_session_block(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_session_block(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.assign_live_session_exercises(
  p_session_id uuid, p_exercice_ids uuid[], p_eleve_ids uuid[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_exercice_id uuid;
  v_eleve_id uuid;
  v_count integer := 0;
  v_formateur_id uuid;
BEGIN
  v_formateur_id := public.get_session_formateur(p_session_id);
  IF v_formateur_id IS NULL OR v_formateur_id <> auth.uid() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  FOREACH v_eleve_id IN ARRAY p_eleve_ids LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.sessions s
      JOIN public.group_members gm ON gm.group_id = s.group_id
      WHERE s.id = p_session_id AND gm.eleve_id = v_eleve_id
    ) THEN
      RAISE EXCEPTION 'Student is not a member of the session group';
    END IF;
    FOREACH v_exercice_id IN ARRAY p_exercice_ids LOOP
      -- Verify that the exercise belongs to the session's trainer
      IF NOT EXISTS (
        SELECT 1 FROM public.exercices
        WHERE id = v_exercice_id AND formateur_id = v_formateur_id
      ) THEN
        RAISE EXCEPTION 'Exercise % does not belong to the session trainer', v_exercice_id;
      END IF;

      INSERT INTO public.session_exercices
        (session_id, exercice_id, eleve_id, is_sent, statut, bloc)
      VALUES
        (p_session_id, v_exercice_id, v_eleve_id, true, 'traite_en_classe', 'bonus')
      ON CONFLICT DO NOTHING;

      IF FOUND THEN
        INSERT INTO public.session_live_events
          (session_id, eleve_id, event_type, payload)
        VALUES (
          p_session_id, v_eleve_id, 'intervention_recue',
          jsonb_build_object('type', 'exercice_personnalise', 'exercice_id', v_exercice_id)
        );
        v_count := v_count + 1;
      END IF;
    END LOOP;
  END LOOP;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_live_session_exercises(uuid, uuid[], uuid[]) TO authenticated;

DROP POLICY IF EXISTS "Eleves view session_exercices" ON public.session_exercices;
DROP POLICY IF EXISTS "eleves_view_session_exercices_content" ON public.session_exercices;
DROP POLICY IF EXISTS "Eleves view session_exercices_secure" ON public.session_exercices;
CREATE POLICY "Eleves view session_exercices_secure" ON public.session_exercices FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.sessions s
    JOIN public.group_members gm ON gm.group_id = s.group_id
    WHERE s.id = session_exercices.session_id AND gm.eleve_id = auth.uid()
  )
  AND (session_exercices.eleve_id IS NULL OR session_exercices.eleve_id = auth.uid())
);

DROP POLICY IF EXISTS "Eleves view assigned exercices" ON public.exercices;
DROP POLICY IF EXISTS "Eleves view assigned exercices secure" ON public.exercices;
CREATE POLICY "Eleves view assigned exercices secure" ON public.exercices FOR SELECT
USING (
  eleve_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.session_exercices se
    JOIN public.sessions s ON s.id = se.session_id
    JOIN public.group_members gm ON gm.group_id = s.group_id
    WHERE se.exercice_id = exercices.id
      AND gm.eleve_id = auth.uid()
      AND (se.eleve_id IS NULL OR se.eleve_id = auth.uid())
  )
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'session_blocks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.session_blocks;
  END IF;
END;
$$;
