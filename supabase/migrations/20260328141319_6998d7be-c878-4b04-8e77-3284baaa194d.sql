
-- Fix vrai_faux exercises missing options: add ["Vrai", "Faux"] to each item
-- Exercise 9: La situation familiale de Sonia (3 items)
UPDATE exercices SET contenu = jsonb_set(
  jsonb_set(
    jsonb_set(contenu, '{items,0,options}', '["Vrai", "Faux"]'::jsonb),
    '{items,1,options}', '["Vrai", "Faux"]'::jsonb
  ),
  '{items,2,options}', '["Vrai", "Faux"]'::jsonb
) WHERE id = 'c7a2d9f2-0f88-4bf6-b184-10da1e34a8b8';

-- Exercise 15: Comprendre les verbes Être et Avoir (2 items)
UPDATE exercices SET contenu = jsonb_set(
  jsonb_set(contenu, '{items,0,options}', '["Vrai", "Faux"]'::jsonb),
  '{items,1,options}', '["Vrai", "Faux"]'::jsonb
) WHERE id = '77297e4e-2615-43e9-b45a-689ac236a18f';

-- Exercise 19: Lire un badge professionnel (3 items)
UPDATE exercices SET contenu = jsonb_set(
  jsonb_set(
    jsonb_set(contenu, '{items,0,options}', '["Vrai", "Faux"]'::jsonb),
    '{items,1,options}', '["Vrai", "Faux"]'::jsonb
  ),
  '{items,2,options}', '["Vrai", "Faux"]'::jsonb
) WHERE id = '6e0fd47d-6f5d-44b0-808a-e97716b443ba';

-- Exercise 29: Le dossier de Youssef (3 items)
UPDATE exercices SET contenu = jsonb_set(
  jsonb_set(
    jsonb_set(contenu, '{items,0,options}', '["Vrai", "Faux"]'::jsonb),
    '{items,1,options}', '["Vrai", "Faux"]'::jsonb
  ),
  '{items,2,options}', '["Vrai", "Faux"]'::jsonb
) WHERE id = '472ee216-fe08-431f-93da-7d57a25f6eea';

-- Fix appariement exercises missing options: add all bonnes_reponses as shared options
-- Exercise 7: Pays et Nationalités (4 items) - add all nationalities as options
UPDATE exercices SET contenu = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(contenu, '{items,0,options}', '["Sénégalais / Sénégalaise", "Algérien / Algérienne", "Afghan / Afghane", "Ivoirien / Ivoirienne"]'::jsonb),
      '{items,1,options}', '["Sénégalais / Sénégalaise", "Algérien / Algérienne", "Afghan / Afghane", "Ivoirien / Ivoirienne"]'::jsonb
    ),
    '{items,2,options}', '["Sénégalais / Sénégalaise", "Algérien / Algérienne", "Afghan / Afghane", "Ivoirien / Ivoirienne"]'::jsonb
  ),
  '{items,3,options}', '["Sénégalais / Sénégalaise", "Algérien / Algérienne", "Afghan / Afghane", "Ivoirien / Ivoirienne"]'::jsonb
) WHERE id = '8d564d47-4e86-4844-885a-eb58f58b7b9d';

-- Exercise 11: Répondre à l'agent administratif (3 items)
UPDATE exercices SET contenu = jsonb_set(
  jsonb_set(
    jsonb_set(contenu, '{items,0,options}', '["C''est le 06 12 34 56 78.", "Enchanté, je suis Carlos.", "C''est le 12, rue de la Paix."]'::jsonb),
    '{items,1,options}', '["C''est le 06 12 34 56 78.", "Enchanté, je suis Carlos.", "C''est le 12, rue de la Paix."]'::jsonb
  ),
  '{items,2,options}', '["C''est le 06 12 34 56 78.", "Enchanté, je suis Carlos.", "C''est le 12, rue de la Paix."]'::jsonb
) WHERE id = '72f7ada0-214e-483a-a977-972210bc34de';

-- Exercise 17: Pays et Nationalités (3 items)
UPDATE exercices SET contenu = jsonb_set(
  jsonb_set(
    jsonb_set(contenu, '{items,0,options}', '["marocaine", "sénégalais", "portugaise"]'::jsonb),
    '{items,1,options}', '["marocaine", "sénégalais", "portugaise"]'::jsonb
  ),
  '{items,2,options}', '["marocaine", "sénégalais", "portugaise"]'::jsonb
) WHERE id = 'fad4db29-32bb-4b9f-9444-28df0beed7c6';
