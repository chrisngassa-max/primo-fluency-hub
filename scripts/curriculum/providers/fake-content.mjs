import { hashContent } from '../lib/hash.mjs';

/**
 * ContentProvider de test : aucun appel reseau. Produit une reponse
 * deterministe (derivee d'un hash du prompt) sauf si un `responder` est
 * fourni pour simuler un cas precis (ex. sortie invalide a rejeter).
 */
export class FakeContentProvider {
  constructor({ responder = null } = {}) {
    this.responder = responder;
    this.calls = [];
  }

  async generateStructured(request) {
    return this._respond('generateStructured', request);
  }

  async review(request) {
    return this._respond('review', request);
  }

  async _respond(fonction, request) {
    this.calls.push({ fonction, request });

    if (this.responder) {
      const data = await this.responder(fonction, request);
      return { data, raw: { fake: true }, usage: { inputTokens: 0, outputTokens: 0 }, model: 'fake-content-model' };
    }

    const seed = hashContent({ fonction, promptVersion: request.promptVersion, userPrompt: request.userPrompt });
    return {
      data: this._defaultPayload(fonction, request, seed),
      raw: { fake: true, seed },
      usage: { inputTokens: 0, outputTokens: 0 },
      model: 'fake-content-model',
    };
  }

  _defaultPayload(fonction, request, seed) {
    if (fonction === 'review') {
      return {
        quality_score: 5,
        pedagogical_relevance_score: 5,
        bloquants: [],
        commentaire: `Revue factice deterministe (${seed.slice(0, 8)})`,
      };
    }

    return {
      generated: true,
      prompt_version: request.promptVersion ?? 'v0',
      seed,
      note: 'Contenu genere par FakeContentProvider (aucun appel reseau).',
    };
  }

  costReport() {
    return { total_cost_eur: 0, max_cost_eur: null, call_count: this.calls.length, entries: [] };
  }
}
