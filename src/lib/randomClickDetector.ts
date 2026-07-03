/**
 * Détecte une suite de 3 réponses rapides (< 3 s) avec faible taux de réussite.
 * Signal comportemental clic_aleatoire_probable — sans type_erreur_id.
 */

const FAST_MS = 3000;
const CONSECUTIVE_FAST = 3;
const LOW_SCORE_RATIO = 0.3;

export interface AnswerTick {
  idx: number;
  at: number;
  isCorrect: boolean | null;
}

export class RandomClickDetector {
  private ticks: AnswerTick[] = [];
  private emitted = false;

  /** Enregistre une réponse ; isCorrect null si inconnu (texte libre). */
  record(idx: number, isCorrect: boolean | null = null): boolean {
    if (this.emitted) return false;
    const at = Date.now();
    this.ticks.push({ idx, at, isCorrect });

    if (this.ticks.length < CONSECUTIVE_FAST) return false;

    const window = this.ticks.slice(-CONSECUTIVE_FAST);
    for (let i = 1; i < window.length; i++) {
      if (window[i].at - window[i - 1].at > FAST_MS) return false;
    }

    const known = window.filter((t) => t.isCorrect !== null);
    if (known.length === 0) return false;

    const correct = known.filter((t) => t.isCorrect).length;
    const ratio = correct / known.length;
    if (ratio > LOW_SCORE_RATIO) return false;

    this.emitted = true;
    return true;
  }

  reset(): void {
    this.ticks = [];
    this.emitted = false;
  }
}
