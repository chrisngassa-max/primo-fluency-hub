// Section 13 : "Chaque appel journalise fonction, modele, tokens, cout,
// statut, finalite et categories de donnees." + "Un plafond global et un
// plafond par ressource arretent les nouveaux appels, sans annuler les
// publications deja atomiquement reussies."
//
// Ledger minimal, en memoire par processus. Les lots 3/5 pourront persister
// ces entrees (ex. table de log) sans changer cette interface.

export class BudgetExceededError extends Error {
  constructor(message, ledgerEntry) {
    super(message);
    this.name = 'BudgetExceededError';
    this.ledgerEntry = ledgerEntry;
  }
}

export class CallLedger {
  constructor({ maxCostEur = null } = {}) {
    this.maxCostEur = maxCostEur === null || maxCostEur === undefined ? null : Number(maxCostEur);
    this.entries = [];
    this.totalCostEur = 0;
  }

  /**
   * @param {{ fonction: string, provider: string, modele: string|null, tokens?: {input?:number, output?:number}, coutEur?: number, statut: 'ok'|'error', finalite: string, categoriesDonnees?: string[] }} entry
   */
  record(entry) {
    const enriched = {
      timestamp: new Date().toISOString(),
      tokens: { input: 0, output: 0 },
      coutEur: 0,
      categoriesDonnees: [],
      ...entry,
    };
    this.entries.push(enriched);
    this.totalCostEur += enriched.coutEur ?? 0;
    return enriched;
  }

  /** Leve BudgetExceededError si l'ajout du cout previsionnel depasse le plafond. */
  assertWithinBudget(projectedCostEur, context = {}) {
    if (this.maxCostEur === null) return;
    const projectedTotal = this.totalCostEur + projectedCostEur;
    if (projectedTotal > this.maxCostEur) {
      throw new BudgetExceededError(
        `Plafond de cout depasse : ${projectedTotal.toFixed(4)} EUR > ${this.maxCostEur} EUR (${context.fonction ?? 'appel inconnu'}).`,
        { projectedTotal, maxCostEur: this.maxCostEur, ...context },
      );
    }
  }

  report() {
    return {
      total_cost_eur: Number(this.totalCostEur.toFixed(6)),
      max_cost_eur: this.maxCostEur,
      call_count: this.entries.length,
      entries: this.entries,
    };
  }
}
