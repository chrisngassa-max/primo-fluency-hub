// Comparateur pur (aucun accès disque) entre un snapshot figé (Lot 0) et un
// payload régénéré par buildInteractiveS01(). Isolé dans son propre module
// pour pouvoir être testé avec des fixtures mutées sans jamais toucher au
// snapshot réel ni au corpus réel (cf. generate-s01-interactive.snapshot.test.mjs).
//
// Ne compare QUE l'enveloppe (volume, ordre, identifiants, nombre d'items,
// durée) — jamais le texte des items, qui peut évoluer au Lot 2.

export function diffAgainstBaseline(baseline, payload) {
  const violations = [];

  if (payload.exercises.length !== baseline.totals.exercise_count) {
    violations.push(
      `exercise_count: attendu ${baseline.totals.exercise_count}, obtenu ${payload.exercises.length}`,
    );
  }

  const payloadByCode = new Map();
  payload.exercises.forEach((entry, index) => {
    payloadByCode.set(entry.metadata_code, { entry, index });
  });

  for (const code of baseline.order) {
    const found = payloadByCode.get(code);
    const expected = baseline.exercises[code];
    if (!found) {
      violations.push(`disparu: ${code}`);
      continue;
    }
    const { entry, index } = found;

    if (index !== expected.position) {
      violations.push(`${code}: position ${expected.position} -> ${index}`);
    }
    if (entry.niveau_vise !== expected.niveau_vise) {
      violations.push(`${code}: niveau_vise ${expected.niveau_vise} -> ${entry.niveau_vise}`);
    }
    if (entry.competence !== expected.competence) {
      violations.push(`${code}: competence ${expected.competence} -> ${entry.competence}`);
    }
    if (entry.format !== expected.format) {
      violations.push(`${code}: format ${expected.format} -> ${entry.format}`);
    }
    if ((entry.family_id ?? null) !== expected.family_id) {
      violations.push(`${code}: family_id ${expected.family_id} -> ${entry.family_id ?? null}`);
    }
    if ((entry.extension_of_family_id ?? null) !== expected.extension_of_family_id) {
      violations.push(
        `${code}: extension_of_family_id ${expected.extension_of_family_id} -> ${entry.extension_of_family_id ?? null}`,
      );
    }
    const activityCode = entry.contenu?.metadata?.activity_code ?? null;
    if (activityCode !== expected.activity_code) {
      violations.push(`${code}: activity_code ${expected.activity_code} -> ${activityCode}`);
    }
    const itemCount = entry.contenu.items.length;
    if (itemCount !== expected.item_count) {
      violations.push(`${code}: item_count ${expected.item_count} -> ${itemCount}`);
    }
    if (entry.duree_limite_secondes !== expected.duree_limite_secondes) {
      violations.push(
        `${code}: duree_limite_secondes ${expected.duree_limite_secondes} -> ${entry.duree_limite_secondes}`,
      );
    }
  }

  for (const code of payloadByCode.keys()) {
    if (!(code in baseline.exercises)) {
      violations.push(`apparu: ${code}`);
    }
  }

  return violations;
}
