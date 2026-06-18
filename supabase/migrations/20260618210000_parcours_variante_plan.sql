-- Variante de plan-cadre pour gérer deux cohortes en parallèle :
--   'enrichi' = Parcours enrichi S8-S20, sans module civique (cohorte actuelle)
--   'civique' = Parcours complet 90h avec module optionnel civique S21-S30 (cohorte suivante)
ALTER TABLE public.parcours
  ADD COLUMN IF NOT EXISTS variante_plan text NOT NULL DEFAULT 'enrichi';

COMMENT ON COLUMN public.parcours.variante_plan IS
  'Variante du plan-cadre : enrichi (S8-S20, sans module civique) ou civique (90h, module optionnel S21-S30, activé si re_signature_civique + examen_civique_obligatoire)';

ALTER TABLE public.parcours
  DROP CONSTRAINT IF EXISTS parcours_variante_plan_check;

ALTER TABLE public.parcours
  ADD CONSTRAINT parcours_variante_plan_check
  CHECK (variante_plan IN ('enrichi', 'civique'));
