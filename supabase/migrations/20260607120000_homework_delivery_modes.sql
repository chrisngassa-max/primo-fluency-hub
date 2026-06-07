ALTER TABLE public.groups
ADD COLUMN IF NOT EXISTS homework_delivery_mode text NOT NULL DEFAULT 'validation';

ALTER TABLE public.groups
DROP CONSTRAINT IF EXISTS groups_homework_delivery_mode_check;

ALTER TABLE public.groups
ADD CONSTRAINT groups_homework_delivery_mode_check
CHECK (homework_delivery_mode IN ('recommendation', 'validation', 'automatic'));

COMMENT ON COLUMN public.groups.homework_delivery_mode IS
'Mode de distribution des devoirs personnalises : recommandation, validation formateur ou envoi automatique autorise.';
