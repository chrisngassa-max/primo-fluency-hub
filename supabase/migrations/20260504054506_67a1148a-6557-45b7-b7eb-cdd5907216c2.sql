ALTER TABLE public.profils_eleves
ADD COLUMN IF NOT EXISTS vitesse_lecture text
CHECK (vitesse_lecture IN ('lente', 'fluide'));

COMMENT ON COLUMN public.profils_eleves.vitesse_lecture IS
'Signal formateur optionnel: lente ou fluide. Utilise pour reduire la charge de lecture et renforcer audio/image.';

CREATE TABLE IF NOT EXISTS public.student_vocabulary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  word text NOT NULL,
  normalized_word text NOT NULL,
  context_sentence text,
  translation text,
  translation_language text DEFAULT 'fr',
  simple_definition text,
  audio_url text,
  review_count integer NOT NULL DEFAULT 0,
  last_reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_vocabulary_student_created
ON public.student_vocabulary(student_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_student_vocabulary_lookup
ON public.student_vocabulary(student_id, normalized_word, translation_language);

ALTER TABLE public.student_vocabulary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "students_read_own_vocabulary"
ON public.student_vocabulary
FOR SELECT
USING (auth.uid() = student_id);

CREATE POLICY "students_insert_own_vocabulary"
ON public.student_vocabulary
FOR INSERT
WITH CHECK (auth.uid() = student_id);

CREATE POLICY "students_update_own_vocabulary"
ON public.student_vocabulary
FOR UPDATE
USING (auth.uid() = student_id)
WITH CHECK (auth.uid() = student_id);

CREATE POLICY "students_delete_own_vocabulary"
ON public.student_vocabulary
FOR DELETE
USING (auth.uid() = student_id);