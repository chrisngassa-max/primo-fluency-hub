
ALTER TABLE public.test_questions DROP CONSTRAINT test_questions_numero_dans_palier_check;
ALTER TABLE public.test_questions ADD CONSTRAINT test_questions_numero_dans_palier_check CHECK (numero_dans_palier >= 1 AND numero_dans_palier <= 7);
