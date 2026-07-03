/** Comptage mots français (déterministe) pour garde-fou EE avant soumission. */

const EE_CODE_MIN: Record<string, number> = {
  EE1: 20,
  EE2: 60,
  EE3: 80,
};

export function countFrenchWords(text: unknown): number {
  if (typeof text !== "string" || !text.trim()) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Déduit le seuil minimal de mots depuis metadata.code, consigne ou contenu.
 * Priorité : metadata.mots_min → plage dans consigne → code TCF → défaut 20.
 */
export function resolveEeMinWords(opts: {
  consigne?: string | null;
  metadataCode?: string | null;
  contenu?: Record<string, unknown> | null;
}): number | null {
  const contenu = opts.contenu ?? {};
  const meta = (contenu.metadata ?? {}) as Record<string, unknown>;
  const explicitMin = meta.mots_min ?? contenu.mots_min;
  if (typeof explicitMin === "number" && explicitMin > 0) return explicitMin;

  const code = (opts.metadataCode ?? meta.code ?? "") as string;
  if (code && EE_CODE_MIN[code]) return EE_CODE_MIN[code];

  const consigne = opts.consigne ?? "";
  const rangeMatch = consigne.match(/(\d+)\s*[-–àa]\s*(\d+)\s*mots/i);
  if (rangeMatch) return parseInt(rangeMatch[1], 10);

  const environMatch = consigne.match(/environ\s+(\d+)\s*mots/i);
  if (environMatch) {
    const target = parseInt(environMatch[1], 10);
    return Math.max(10, Math.floor(target * 0.85));
  }

  const simpleMatch = consigne.match(/(\d+)\s*mots/i);
  if (simpleMatch) {
    const n = parseInt(simpleMatch[1], 10);
    return Math.max(10, Math.floor(n * 0.85));
  }

  if (code.startsWith("EE")) return EE_CODE_MIN.EE1;
  return null;
}

export function eeWordCountStatus(
  text: unknown,
  minWords: number,
): { count: number; ok: boolean; message: string } {
  const count = countFrenchWords(text);
  const ok = count >= minWords;
  const message = ok
    ? `${count} mot${count > 1 ? "s" : ""} — minimum ${minWords}`
    : `Production trop courte : ${count}/${minWords} mots minimum. Complète ta réponse avant de soumettre.`;
  return { count, ok, message };
}
