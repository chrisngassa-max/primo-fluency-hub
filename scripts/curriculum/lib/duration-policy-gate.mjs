// Lot 1 (correctif, point 2) — politique temporelle opérationnelle mais
// recalibrable.
//
// `duree_limite_secondes` (sur chaque exercice) reste le temps opérationnel
// réellement utilisé. `duration_policy.mode` ne fait que déclarer si un
// dépassement de ce temps peut être SIGNALÉ ("warning", jamais bloquant) ou,
// un jour, BLOQUANT ("blocking") — mais seulement si les trois conditions
// ci-dessous sont réunies. Tant qu'aucune campagne de calibration validée
// n'existe, un mode "blocking" mal posé ne doit jamais produire un blocage
// réel : ce module plafonne la sévérité effective à "warning".
//
// Les trois conditions requises pour qu'un mode "blocking" soit honoré :
//   1. target_seconds est défini et strictement positif.
//   2. calibration_id est défini et non vide.
//   3. Le registre de calibration déclare ce calibration_id avec un statut
//      explicitement "validated".
// Aucun registre de calibration versionné n'existe encore dans ce dépôt :
// calibrationRegistry est donc vide par défaut, et la condition 3 échoue
// systématiquement tant qu'il n'est pas peuplé.

export function isCalibrationValidated(calibrationId, calibrationRegistry = {}) {
  if (typeof calibrationId !== "string" || calibrationId.length === 0) return false;
  const entry = calibrationRegistry[calibrationId];
  return Boolean(entry && entry.status === "validated");
}

export function isBlockingGateSatisfied(durationPolicy, calibrationRegistry = {}) {
  if (!durationPolicy) return false;
  const hasPositiveTarget =
    typeof durationPolicy.target_seconds === "number" && Number.isFinite(durationPolicy.target_seconds) &&
    durationPolicy.target_seconds > 0;
  const hasCalibrationId =
    typeof durationPolicy.calibration_id === "string" && durationPolicy.calibration_id.length > 0;
  return hasPositiveTarget && hasCalibrationId && isCalibrationValidated(durationPolicy.calibration_id, calibrationRegistry);
}

// Sévérité RÉELLEMENT applicable pour une duration_policy donnée :
// - "warning" : mode "warning", ou mode "blocking" déclaré mais non
//   calibré (plafonné, jamais un échec bloquant réel) ;
// - "blocking" : mode "blocking" ET les trois conditions satisfaites ;
// - "pass" : mode "informative" (ou absent), aucun signalement.
export function effectiveDurationPolicySeverity(durationPolicy, calibrationRegistry = {}) {
  const mode = durationPolicy?.mode;
  if (mode === "blocking") {
    return isBlockingGateSatisfied(durationPolicy, calibrationRegistry) ? "blocking" : "warning";
  }
  if (mode === "warning") return "warning";
  return "pass";
}
