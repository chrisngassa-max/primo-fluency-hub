// Resout les options CLI --only/--from/--to (section 10) en une liste
// ordonnee de session_code, a partir de l'ordre du manifeste racine
// (content/curriculum/v2/manifest.json, champ `ordre`).
export function resolveSessionCodes({ manifest, only, from, to }) {
  const orderedEntries = [...manifest.entries].sort((a, b) => a.ordre - b.ordre);
  const orderedCodes = orderedEntries.map((entry) => entry.session_code);
  const knownCodes = new Set(orderedCodes);

  if (only && only.length > 0) {
    const unknown = only.filter((code) => !knownCodes.has(code));
    if (unknown.length > 0) {
      throw new Error(`session-order: session(s) inconnue(s) dans --only : ${unknown.join(', ')}.`);
    }
    return orderedCodes.filter((code) => only.includes(code));
  }

  if (from || to) {
    const fromEntry = orderedEntries.find((entry) => entry.session_code === (from ?? orderedCodes[0]));
    const toEntry = orderedEntries.find((entry) => entry.session_code === (to ?? orderedCodes.at(-1)));
    if (!fromEntry) throw new Error(`session-order: --from "${from}" est inconnu.`);
    if (!toEntry) throw new Error(`session-order: --to "${to}" est inconnu.`);
    if (fromEntry.ordre > toEntry.ordre) {
      throw new Error(`session-order: --from (${from}) doit precéder --to (${to}).`);
    }
    return orderedEntries.filter((entry) => entry.ordre >= fromEntry.ordre && entry.ordre <= toEntry.ordre).map((entry) => entry.session_code);
  }

  return orderedCodes;
}

export function findManifestEntry(manifest, sessionCode) {
  const entry = manifest.entries.find((candidate) => candidate.session_code === sessionCode);
  if (!entry) throw new Error(`session-order: entree de manifeste introuvable pour "${sessionCode}".`);
  return entry;
}
