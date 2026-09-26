/** Limites de consommation / taille — Lot 3B-3 Phase A (préflight). */
export const ASSISTANT_LIMITS = {
  /** Longueur max question élève (caractères). */
  maxQuestionChars: 400,
  /** Longueur max réponse renvoyée à l’UI. */
  maxResponseChars: 600,
  /** Faits validés max envoyés au modèle. */
  maxFacts: 6,
  /** Entrées lexique max. */
  maxLexique: 6,
  /** Questions IA max / jour / navigateur (compteur localStorage). */
  maxQuestionsPerDay: 30,
  /** Timeout provider (ms) avant fallback FAQ. */
  providerTimeoutMs: 8_000,
  /** Tokens de sortie recommandés côté Edge (Phase B). */
  maxOutputTokens: 220,
} as const;

const USAGE_PREFIX = "captcf_assistant_usage_";

function todayKey(): string {
  return `${USAGE_PREFIX}${new Date().toISOString().slice(0, 10)}`;
}

export function getAssistantUsageCount(): number {
  if (typeof localStorage === "undefined") return 0;
  const raw = localStorage.getItem(todayKey());
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function canConsumeAssistantQuota(): boolean {
  return getAssistantUsageCount() < ASSISTANT_LIMITS.maxQuestionsPerDay;
}

/** Incrémente le compteur local après un appel IA réussi (pas FAQ). */
export function recordAssistantConsumption(): void {
  if (typeof localStorage === "undefined") return;
  const next = getAssistantUsageCount() + 1;
  localStorage.setItem(todayKey(), String(next));
}

export function truncateForAssistant(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

export function withTimeout<T>(promise: Promise<T>, ms: number, label = "timeout"): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(label)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
