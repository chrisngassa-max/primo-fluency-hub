-- RETOUR ARRIÈRE PROPOSÉ — NE PAS EXÉCUTER.
-- Préalable : aide Lot 2 OFF, arrêt de tous les appelants/réservations,
-- vérification des dépendances et archivage autorisé de l'état si nécessaire.
-- Ce script refuse de supprimer un état utilisé. Pas de CASCADE.
BEGIN;
LOCK TABLE captcf_help_private.attempt_state,
           captcf_help_private.resource_state,
           captcf_help_private.request_receipt IN ACCESS EXCLUSIVE MODE;
DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM captcf_help_private.attempt_state)
     OR EXISTS (SELECT 1 FROM captcf_help_private.resource_state)
     OR EXISTS (SELECT 1 FROM captcf_help_private.request_receipt) THEN
    RAISE EXCEPTION 'Retour arrière refusé : état non vide. Extinction et conservation/purge à autoriser séparément.';
  END IF;
END;
$guard$;
DROP TABLE captcf_help_private.request_receipt;
DROP TABLE captcf_help_private.resource_state;
DROP TABLE captcf_help_private.attempt_state;
DROP SCHEMA captcf_help_private;
COMMIT;
