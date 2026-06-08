BEGIN;

ALTER TABLE public.profils_eleves
  ADD COLUMN IF NOT EXISTS niveau_baseline_at timestamptz,
  ADD COLUMN IF NOT EXISTS niveau_reference_date date,
  ADD COLUMN IF NOT EXISTS niveau_reference_note text;

ALTER TABLE public.profils_eleves
  DROP CONSTRAINT IF EXISTS profils_eleves_niveau_source_check;
ALTER TABLE public.profils_eleves
  DROP CONSTRAINT IF EXISTS profils_eleves_niveau_source_check1;
ALTER TABLE public.profils_eleves
  DROP CONSTRAINT IF EXISTS profils_eleves_niveau_source_check2;

ALTER TABLE public.profils_eleves
  ADD CONSTRAINT profils_eleves_niveau_source_check
  CHECK (
    niveau_source IS NULL OR niveau_source IN (
      'placement_test',
      'manuel',
      'recalibrage_auto',
      'atelier_bilan',
      'tcf_irn_officiel'
    )
  );

CREATE TABLE IF NOT EXISTS public.student_level_baselines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eleve_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  set_by uuid NOT NULL REFERENCES public.profiles(id),
  source text NOT NULL CHECK (source IN ('tcf_irn_officiel', 'manuel')),
  reference_date date NOT NULL,
  niveau_global text NOT NULL CHECK (niveau_global IN ('A0','A1','A2','B1','B2')),
  niveau_co text NOT NULL CHECK (niveau_co IN ('A0','A1','A2','B1','B2')),
  niveau_ce text NOT NULL CHECK (niveau_ce IN ('A0','A1','A2','B1','B2')),
  niveau_ee text NOT NULL CHECK (niveau_ee IN ('A0','A1','A2','B1','B2')),
  niveau_eo text NOT NULL CHECK (niveau_eo IN ('A0','A1','A2','B1','B2')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.student_level_baselines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Formateurs read assigned student baselines" ON public.student_level_baselines;
CREATE POLICY "Formateurs read assigned student baselines"
  ON public.student_level_baselines FOR SELECT TO authenticated
  USING (
    eleve_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.group_members gm
      JOIN public.groups g ON g.id = gm.group_id
      WHERE gm.eleve_id = student_level_baselines.eleve_id
        AND g.formateur_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.set_student_level_baseline(
  p_eleve_id uuid,
  p_levels jsonb,
  p_reference_date date,
  p_note text DEFAULT NULL
)
RETURNS public.profils_eleves
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_co text := upper(trim(COALESCE(p_levels->>'co', '')));
  v_ce text := upper(trim(COALESCE(p_levels->>'ce', '')));
  v_ee text := upper(trim(COALESCE(p_levels->>'ee', '')));
  v_eo text := upper(trim(COALESCE(p_levels->>'eo', '')));
  v_global text;
  v_profile public.profils_eleves;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.group_members gm
    JOIN public.groups g ON g.id = gm.group_id
    WHERE gm.eleve_id = p_eleve_id
      AND g.formateur_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_reference_date IS NULL OR p_reference_date > current_date THEN
    RAISE EXCEPTION 'Invalid TCF reference date';
  END IF;

  IF v_co NOT IN ('A0','A1','A2','B1','B2')
    OR v_ce NOT IN ('A0','A1','A2','B1','B2')
    OR v_ee NOT IN ('A0','A1','A2','B1','B2')
    OR v_eo NOT IN ('A0','A1','A2','B1','B2') THEN
    RAISE EXCEPTION 'Invalid CEFR level';
  END IF;

  SELECT level_value INTO v_global
  FROM (
    VALUES
      (v_co, array_position(ARRAY['A0','A1','A2','B1','B2'], v_co)),
      (v_ce, array_position(ARRAY['A0','A1','A2','B1','B2'], v_ce)),
      (v_ee, array_position(ARRAY['A0','A1','A2','B1','B2'], v_ee)),
      (v_eo, array_position(ARRAY['A0','A1','A2','B1','B2'], v_eo))
  ) AS levels(level_value, level_order)
  ORDER BY level_order
  LIMIT 1;

  UPDATE public.profils_eleves
  SET niveau_actuel = v_global,
      niveau_co = v_co,
      niveau_ce = v_ce,
      niveau_ee = v_ee,
      niveau_eo = v_eo,
      niveau_source = 'tcf_irn_officiel',
      niveau_locked = true,
      niveau_baseline_at = now(),
      niveau_reference_date = p_reference_date,
      niveau_reference_note = NULLIF(trim(p_note), ''),
      niveau_updated_at = now(),
      updated_at = now()
  WHERE eleve_id = p_eleve_id
  RETURNING * INTO v_profile;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student profile not found';
  END IF;

  INSERT INTO public.student_level_baselines (
    eleve_id,
    set_by,
    source,
    reference_date,
    niveau_global,
    niveau_co,
    niveau_ce,
    niveau_ee,
    niveau_eo,
    note
  ) VALUES (
    p_eleve_id,
    auth.uid(),
    'tcf_irn_officiel',
    p_reference_date,
    v_global,
    v_co,
    v_ce,
    v_ee,
    v_eo,
    NULLIF(trim(p_note), '')
  );

  RETURN v_profile;
END;
$$;

REVOKE ALL ON FUNCTION public.set_student_level_baseline(uuid, jsonb, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_student_level_baseline(uuid, jsonb, date, text) TO authenticated;

COMMIT;
