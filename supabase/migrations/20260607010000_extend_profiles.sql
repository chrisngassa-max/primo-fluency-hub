ALTER TABLE public.profils_eleves
  ADD COLUMN IF NOT EXISTS langue_maternelle text,
  ADD COLUMN IF NOT EXISTS autres_langues text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS niveau_scolarisation text,
  ADD COLUMN IF NOT EXISTS aisance_numerique text,
  ADD COLUMN IF NOT EXISTS projet_personnel text,
  ADD COLUMN IF NOT EXISTS objectif_tcf text,
  ADD COLUMN IF NOT EXISTS date_cible_tcf date,
  ADD COLUMN IF NOT EXISTS preferences_apprentissage text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS besoins_accessibilite text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS disponibilite_hors_seance text;

ALTER TABLE public.profils_eleves
  DROP CONSTRAINT IF EXISTS profils_eleves_niveau_scolarisation_check,
  DROP CONSTRAINT IF EXISTS profils_eleves_aisance_numerique_check,
  DROP CONSTRAINT IF EXISTS profils_eleves_objectif_tcf_check;

ALTER TABLE public.profils_eleves
  ADD CONSTRAINT profils_eleves_niveau_scolarisation_check
    CHECK (niveau_scolarisation IS NULL OR niveau_scolarisation IN ('non_scolarise', 'primaire', 'college', 'lycee', 'superieur')),
  ADD CONSTRAINT profils_eleves_aisance_numerique_check
    CHECK (aisance_numerique IS NULL OR aisance_numerique IN ('faible', 'moyenne', 'bonne')),
  ADD CONSTRAINT profils_eleves_objectif_tcf_check
    CHECK (objectif_tcf IS NULL OR objectif_tcf IN ('irn', 'quebec', 'canada', 'tout_public'));

DROP POLICY IF EXISTS "Eleves update own andragogical profile" ON public.profils_eleves;
DROP POLICY IF EXISTS "Formateurs update student andragogical profiles" ON public.profils_eleves;

CREATE OR REPLACE FUNCTION public.update_andragogical_profile(
  p_eleve_id uuid,
  p_profile jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() <> p_eleve_id AND NOT EXISTS (
    SELECT 1
    FROM public.group_members gm
    JOIN public.groups g ON g.id = gm.group_id
    WHERE gm.eleve_id = p_eleve_id
      AND g.formateur_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE public.profils_eleves
  SET langue_maternelle = NULLIF(trim(p_profile->>'langue_maternelle'), ''),
      autres_langues = COALESCE(
        ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_profile->'autres_langues', '[]'::jsonb))),
        ARRAY[]::text[]
      ),
      niveau_scolarisation = NULLIF(p_profile->>'niveau_scolarisation', ''),
      aisance_numerique = NULLIF(p_profile->>'aisance_numerique', ''),
      projet_personnel = NULLIF(trim(p_profile->>'projet_personnel'), ''),
      objectif_tcf = NULLIF(p_profile->>'objectif_tcf', ''),
      date_cible_tcf = NULLIF(p_profile->>'date_cible_tcf', '')::date,
      preferences_apprentissage = COALESCE(
        ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_profile->'preferences_apprentissage', '[]'::jsonb))),
        ARRAY[]::text[]
      ),
      besoins_accessibilite = COALESCE(
        ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_profile->'besoins_accessibilite', '[]'::jsonb))),
        ARRAY[]::text[]
      ),
      disponibilite_hors_seance = NULLIF(trim(p_profile->>'disponibilite_hors_seance'), ''),
      updated_at = now()
  WHERE eleve_id = p_eleve_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student profile not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_andragogical_profile(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_andragogical_profile(uuid, jsonb) TO authenticated;
