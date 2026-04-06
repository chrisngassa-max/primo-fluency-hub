CREATE OR REPLACE FUNCTION public.update_priorites_pedagogiques(p_eleve_id UUID, p_nouvelle_priorite TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE profils_eleves
  SET priorites_pedagogiques = (
    SELECT jsonb_agg(DISTINCT p) FROM (
      SELECT p FROM jsonb_array_elements_text(COALESCE(priorites_pedagogiques, '[]'::jsonb)) p
      UNION ALL SELECT p_nouvelle_priorite
      LIMIT 3
    ) s
  ),
  updated_at = now()
  WHERE eleve_id = p_eleve_id;
END;
$$;