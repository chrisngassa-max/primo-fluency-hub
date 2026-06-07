-- =====================================================================================
-- STRATÉGIE DE RETOUR ARRIÈRE (ROLLBACK) — 20260606020000_session_automation.sql
-- =====================================================================================
-- WARNING/IMPORTANT:
-- 1. ROLLBACK DESTRUCTIF (développement uniquement) :
--    Autorisé UNIQUEMENT sur un environnement local ou de test avant toute utilisation en
--    production. Il supprime les tables et colonnes ajoutées, ce qui entraîne une perte de données.
-- 2. ROLLBACK DE PRODUCTION (non destructif) :
--    En production, les colonnes et tables ne doivent PAS être supprimées directement pour éviter
--    les pertes de données. Le rollback se contente de désactiver les fonctionnalités
--    d'orchestration automatique tout en maintenant la compatibilité des données.
-- 3. RLS SÉCURISÉES :
--    Les anciennes politiques RLS vulnérables ne sont pas restaurées. Les versions sécurisées
--    sont maintenues pour garantir l'étanchéité des données élèves.
-- 4. IDÉMPOTENCE ET UNIQUENESS :
--    Nous renonçons explicitement à restaurer l'ancienne contrainte UNIQUE (session_id, exercice_id)
--    sur la table session_exercices, car tout exercice déjà assigné individuellement à plusieurs
--    élèves provoquerait l'échec de la création de la contrainte et bloquerait la base de données.
-- =====================================================================================

BEGIN;

-- =====================================================================================
-- SECTION A : ROLLBACK DE PRODUCTION NON DESTRUCTIF (Activé par défaut)
-- =====================================================================================

-- 1. Désactiver la génération automatique par défaut pour toutes les séances
ALTER TABLE public.sessions ALTER COLUMN generation_automatique_activee SET DEFAULT false;
UPDATE public.sessions SET generation_automatique_activee = false;

-- 2. Retirer les fonctions d'automatisation de l'accès direct (sans détruire les tables)
REVOKE EXECUTE ON FUNCTION public.assign_live_session_exercises(uuid, uuid[], uuid[]) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_session_block(uuid, text) FROM service_role;

-- 3. Conserver les nouvelles politiques RLS sécurisées (ne pas restaurer les anciennes vulnérables)
-- Les politiques sécurisées "Eleves view session_exercices_secure" et "Eleves view assigned exercices secure"
-- restent actives car elles protègent les données personnelles des élèves sans empêcher le fonctionnement historique.

-- 4. Conserver les index partiels (ne pas restaurer l'ancienne contrainte unique rigide)
-- Restaurer UNIQUE(session_id, exercice_id) échouerait en production si des élèves ont reçu des exercices
-- individuels partagés. L'index unique partiel est donc maintenu pour préserver l'intégrité opérationnelle.

COMMIT;


-- =====================================================================================
-- SECTION B : TEMPLATE DE ROLLBACK DESTRUCTIF (À n'exécuter que manuellement en local)
-- =====================================================================================
/*
BEGIN;

-- 1. Retirer la table de la publication Realtime
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.session_blocks;

-- 2. Supprimer les fonctions personnalisées
DROP FUNCTION IF EXISTS public.assign_live_session_exercises(uuid, uuid[], uuid[]);
DROP FUNCTION IF EXISTS public.claim_session_block(uuid, text);

-- 3. Supprimer la table session_blocks
DROP TABLE IF EXISTS public.session_blocks CASCADE;

-- 4. Supprimer la colonne bloc sur session_exercices
ALTER TABLE public.session_exercices DROP CONSTRAINT IF EXISTS session_exercices_bloc_check;
ALTER TABLE public.session_exercices DROP COLUMN IF EXISTS bloc;

-- 5. Supprimer les colonnes ajoutées à public.sessions
ALTER TABLE public.sessions
  DROP CONSTRAINT IF EXISTS sessions_nb_exercices_souhaite_check,
  DROP CONSTRAINT IF EXISTS sessions_nb_exercices_retrospective_check,
  DROP CONSTRAINT IF EXISTS sessions_duree_retrospective_check,
  DROP CONSTRAINT IF EXISTS sessions_nb_questions_diagnostic_check,
  DROP CONSTRAINT IF EXISTS sessions_difficulte_par_defaut_check;

ALTER TABLE public.sessions
  DROP COLUMN IF EXISTS nb_exercices_souhaite,
  DROP COLUMN IF EXISTS nb_exercices_retrospective,
  DROP COLUMN IF EXISTS duree_retrospective,
  DROP COLUMN IF EXISTS nb_questions_diagnostic,
  DROP COLUMN IF EXISTS competences_autorisees,
  DROP COLUMN IF EXISTS difficulte_par_defaut,
  DROP COLUMN IF EXISTS generation_automatique_activee;

-- 6. Nettoyage des associations individuelles et restauration de la contrainte unique historique
DELETE FROM public.session_exercices WHERE eleve_id IS NOT NULL;
DROP INDEX IF EXISTS public.session_exercices_collective_unique;
DROP INDEX IF EXISTS public.session_exercices_individual_unique;
ALTER TABLE public.session_exercices
  ADD CONSTRAINT session_exercices_session_id_exercice_id_key UNIQUE (session_id, exercice_id);

COMMIT;
*/

