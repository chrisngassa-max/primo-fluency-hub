
-- 1. Add 'progression' to alerte_type enum
ALTER TYPE public.alerte_type ADD VALUE IF NOT EXISTS 'progression';

-- 2. Create student_competency_levels table for tracking per-competence difficulty level (0-10)
CREATE TABLE public.student_competency_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eleve_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  competence public.competence_type NOT NULL,
  niveau_actuel integer NOT NULL DEFAULT 3,
  validated_at timestamp with time zone DEFAULT now(),
  validated_by uuid REFERENCES public.profiles(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(eleve_id, competence)
);

-- 3. Enable RLS
ALTER TABLE public.student_competency_levels ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies
CREATE POLICY "Eleves view own levels"
  ON public.student_competency_levels FOR SELECT
  USING (eleve_id = auth.uid());

CREATE POLICY "Formateurs view student levels"
  ON public.student_competency_levels FOR SELECT
  USING (eleve_id IN (
    SELECT gm.eleve_id FROM group_members gm
    JOIN groups g ON g.id = gm.group_id
    WHERE g.formateur_id = auth.uid()
  ));

CREATE POLICY "Formateurs manage student levels"
  ON public.student_competency_levels FOR ALL
  USING (
    eleve_id IN (
      SELECT gm.eleve_id FROM group_members gm
      JOIN groups g ON g.id = gm.group_id
      WHERE g.formateur_id = auth.uid()
    )
  )
  WITH CHECK (
    eleve_id IN (
      SELECT gm.eleve_id FROM group_members gm
      JOIN groups g ON g.id = gm.group_id
      WHERE g.formateur_id = auth.uid()
    )
  );

CREATE POLICY "Eleves manage own levels"
  ON public.student_competency_levels FOR ALL
  USING (eleve_id = auth.uid())
  WITH CHECK (eleve_id = auth.uid());
