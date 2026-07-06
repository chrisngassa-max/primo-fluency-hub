import { EXPECTED_HOURS, PALIERS } from '../schemas/constants.mjs';

/**
 * Calcule les heures "cours collectifs" et "evaluations hors seances" par
 * palier, puis le cumul A2 -> B1 -> B2, conformement au tableau de la
 * section 3 ("Repartition horaire et rythme") :
 *   A2 : S1-S25 (75h) + E1 (2h) + E2 (3h) = 80h
 *   B1 : + S26-S31 (18h) + E3 (2h)        = 100h (cumule)
 *   B2 : + S32-S37 (18h) + E4 (2h)        = 120h (cumule)
 *
 * `entries` doit contenir les 41 lignes du manifeste racine (S01-S37 + E1-E4),
 * chacune avec { kind: 'session'|'evaluation', palier, duree_minutes }.
 */
export function computeHoursByPalier(entries) {
  const parPalier = Object.fromEntries(
    PALIERS.map((palier) => [palier, { cours_minutes: 0, evaluations_minutes: 0 }]),
  );

  for (const entry of entries) {
    const bucket = parPalier[entry.palier];
    if (!bucket) continue;
    if (entry.kind === 'evaluation') {
      bucket.evaluations_minutes += entry.duree_minutes;
    } else {
      bucket.cours_minutes += entry.duree_minutes;
    }
  }

  const proprePalier = Object.fromEntries(
    PALIERS.map((palier) => {
      const { cours_minutes, evaluations_minutes } = parPalier[palier];
      return [
        palier,
        {
          cours_heures: cours_minutes / 60,
          evaluations_heures: evaluations_minutes / 60,
          heures_propres: (cours_minutes + evaluations_minutes) / 60,
        },
      ];
    }),
  );

  let cumul = 0;
  const cumulatif = {};
  for (const palier of PALIERS) {
    cumul += proprePalier[palier].heures_propres;
    cumulatif[palier] = {
      ...proprePalier[palier],
      heures_cumulees: cumul,
      heures_attendues: EXPECTED_HOURS[palier],
      ecart: Number((cumul - EXPECTED_HOURS[palier]).toFixed(4)),
    };
  }

  return cumulatif;
}

/**
 * Valide la coherence 80/100/120h. Retourne { valid, errors, details }.
 * N'effectue aucun appel reseau : validateur purement structurel utilisable
 * en preflight (section 0, etape 1) comme en test unitaire (section 12.1).
 */
export function validateCumulativeHours(entries) {
  const details = computeHoursByPalier(entries);
  const errors = [];

  for (const palier of PALIERS) {
    const { heures_cumulees, heures_attendues, ecart } = details[palier];
    if (Math.abs(ecart) > 1e-6) {
      errors.push(
        `Palier ${palier} : ${heures_cumulees}h cumulees, ${heures_attendues}h attendues (ecart ${ecart > 0 ? '+' : ''}${ecart}h).`,
      );
    }
  }

  return { valid: errors.length === 0, errors, details };
}
