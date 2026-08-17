-- Studio audio B2: point de maîtrise CO dédié à la compréhension des points de vue argumentés.
-- Additive and idempotent. Does not modify existing points.
-- Stable id continues the catalog after c1000000-0000-0000-0000-000000000030.
-- Do not reuse 000000000008: that UUID already belongs to a CE point.

INSERT INTO public.points_a_maitriser (
  id,
  sous_section_id,
  nom,
  description,
  niveau_min,
  niveau_max,
  ordre
)
SELECT
  'c1000000-0000-0000-0000-000000000031'::uuid,
  ss.id,
  'Comprendre et interpréter des points de vue argumentés',
  'Identifier un point de vue, une argumentation et un implicite étayé dans un document audio B2 du Studio.',
  'B2',
  'B2',
  COALESCE(
    (
      SELECT MAX(existing.ordre) + 1
      FROM public.points_a_maitriser AS existing
      WHERE existing.sous_section_id = ss.id
    ),
    10
  )
FROM public.sous_sections AS ss
JOIN public.epreuves AS e ON e.id = ss.epreuve_id
WHERE e.competence = 'CO'
  AND ss.nom = 'Vie quotidienne'
  AND NOT EXISTS (
    SELECT 1
    FROM public.points_a_maitriser AS existing
    WHERE existing.id = 'c1000000-0000-0000-0000-000000000031'::uuid
      OR (
        existing.nom = 'Comprendre et interpréter des points de vue argumentés'
        AND existing.niveau_min = 'B2'
        AND existing.niveau_max = 'B2'
        AND existing.sous_section_id IN (
          SELECT ss_co.id
          FROM public.sous_sections AS ss_co
          JOIN public.epreuves AS e_co ON e_co.id = ss_co.epreuve_id
          WHERE e_co.competence = 'CO'
        )
      )
  )
LIMIT 1;
