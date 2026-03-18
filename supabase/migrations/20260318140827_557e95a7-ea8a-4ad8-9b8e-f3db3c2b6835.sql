-- Force types regeneration: niveau columns are now TEXT after DROP TYPE niveau_cecrl
-- Verify current column types
SELECT column_name, data_type, table_name 
FROM information_schema.columns 
WHERE column_name IN ('niveau', 'niveau_cible', 'niveau_vise', 'niveau_min', 'niveau_max', 'niveau_actuel', 'niveau_estime')
AND table_schema = 'public';