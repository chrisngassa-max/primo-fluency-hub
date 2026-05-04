ALTER TABLE public.profils_eleves
ADD COLUMN IF NOT EXISTS vitesse_lecture text
CHECK (vitesse_lecture IN ('lente', 'fluide'));

COMMENT ON COLUMN public.profils_eleves.vitesse_lecture IS
'Signal formateur optionnel: lente ou fluide. Utilise pour reduire la charge de lecture et renforcer audio/image.';
