ALTER TABLE public.parcours ADD COLUMN date_examen_cible DATE;
ALTER TABLE public.parcours ADD COLUMN nb_seances_realisees INTEGER NOT NULL DEFAULT 0;