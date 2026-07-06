import { withExponentialBackoff } from '../lib/retry.mjs';
import { CallLedger } from '../lib/call-ledger.mjs';

const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

// Prix indicatifs par defaut (EUR / 1000 tokens), utilises uniquement pour
// estimer un cout de garde-fou tant qu'aucun tarif reel n'est fourni. Les
// couts reels doivent venir de la reponse API (usage.input_tokens /
// usage.output_tokens) une fois connus pour le modele configure.
const DEFAULT_EUR_PER_1K_INPUT = 0.003;
const DEFAULT_EUR_PER_1K_OUTPUT = 0.015;

/**
 * ContentProvider reel : structure/redige via l'API Anthropic Messages,
 * en for�ant une sortie structuree via tool-use (section 4.1, 9.2, 9.3).
 * Les noms de modeles proviennent exclusivement de la configuration
 * (ANTHROPIC_CONTENT_MODEL / ANTHROPIC_REVIEW_MODEL), jamais codes en dur.
 */
export class AnthropicContentProvider {
  constructor({ apiKey, contentModel, reviewModel, maxTokens = 4096, maxCostEur = null, fetchImpl = fetch } = {}) {
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY est requis pour CONTENT_PROVIDER=anthropic.');
    }
    if (!contentModel) {
      throw new Error('ANTHROPIC_CONTENT_MODEL est requis (les noms de modele ne sont pas codes en dur).');
    }

    this.apiKey = apiKey;
    this.contentModel = contentModel;
    this.reviewModel = reviewModel ?? contentModel;
    this.maxTokens = maxTokens;
    this.fetchImpl = fetchImpl;
    this.ledger = new CallLedger({ maxCostEur });
  }

  async generateStructured({ promptVersion, systemPrompt, userPrompt, jsonSchema, toolName = 'emit_result', sourceExtracts = [] }) {
    return this._callStructured({
      fonction: 'generateStructured',
      model: this.contentModel,
      promptVersion,
      systemPrompt,
      userPrompt,
      jsonSchema,
      toolName,
      sourceExtracts,
    });
  }

  async review({ promptVersion, content, rubric, jsonSchema, toolName = 'emit_review', sourceExtracts = [] }) {
    const userPrompt = [
      'Relis le contenu pedagogique suivant en te fondant uniquement sur la grille fournie.',
      '--- CONTENU A RELIRE ---',
      typeof content === 'string' ? content : JSON.stringify(content, null, 2),
      '--- GRILLE DE REVUE ---',
      typeof rubric === 'string' ? rubric : JSON.stringify(rubric, null, 2),
    ].join('\n\n');

    return this._callStructured({
      fonction: 'review',
      model: this.reviewModel,
      promptVersion,
      systemPrompt: 'Tu es un relecteur pedagogique independant. Tu ne rediges pas le contenu, tu le controles.',
      userPrompt,
      jsonSchema,
      toolName,
      sourceExtracts,
    });
  }

  async _callStructured({ fonction, model, promptVersion, systemPrompt, userPrompt, jsonSchema, toolName, sourceExtracts }) {
    const sourcesBlock = sourceExtracts.length
      ? `\n\nExtraits de sources autorisees (ne rien affirmer hors de ces extraits pour un fait sensible) :\n${sourceExtracts
          .map((extract, i) => `[${i + 1}] ${extract.url ?? extract.source_id ?? '?'} :: ${extract.text}`)
          .join('\n')}`
      : '';

    const projectedCost =
      (this.maxTokens / 1000) * DEFAULT_EUR_PER_1K_INPUT + (this.maxTokens / 1000) * DEFAULT_EUR_PER_1K_OUTPUT;
    this.ledger.assertWithinBudget(projectedCost, { fonction, model });

    const body = {
      model,
      max_tokens: this.maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: `${userPrompt}${sourcesBlock}` }],
      tools: [
        {
          name: toolName,
          description: `Emet le resultat structure attendu (prompt_version=${promptVersion ?? 'n/a'}).`,
          input_schema: jsonSchema,
        },
      ],
      tool_choice: { type: 'tool', name: toolName },
    };

    let response;
    let statut = 'ok';
    try {
      response = await withExponentialBackoff(() =>
        this.fetchImpl(ANTHROPIC_ENDPOINT, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': ANTHROPIC_VERSION,
          },
          body: JSON.stringify(body),
        }),
      );
    } catch (error) {
      statut = 'error';
      this.ledger.record({ fonction, provider: 'anthropic', modele: model, statut, finalite: 'curriculum-generation' });
      throw error;
    }

    if (!response.ok) {
      statut = 'error';
      const errorText = await response.text();
      this.ledger.record({ fonction, provider: 'anthropic', modele: model, statut, finalite: 'curriculum-generation' });
      throw new Error(`Anthropic error (${fonction}): ${response.status} ${response.statusText} - ${errorText.slice(0, 500)}`);
    }

    const json = await response.json();
    const toolUse = json.content?.find((block) => block.type === 'tool_use' && block.name === toolName);
    if (!toolUse) {
      statut = 'error';
      this.ledger.record({ fonction, provider: 'anthropic', modele: model, statut, finalite: 'curriculum-generation' });
      throw new Error(`Anthropic (${fonction}) n'a pas retourne d'appel d'outil "${toolName}".`);
    }

    const usage = {
      inputTokens: json.usage?.input_tokens ?? 0,
      outputTokens: json.usage?.output_tokens ?? 0,
    };
    const coutEur =
      (usage.inputTokens / 1000) * DEFAULT_EUR_PER_1K_INPUT + (usage.outputTokens / 1000) * DEFAULT_EUR_PER_1K_OUTPUT;

    this.ledger.record({
      fonction,
      provider: 'anthropic',
      modele: model,
      tokens: usage,
      coutEur,
      statut,
      finalite: 'curriculum-generation',
      categoriesDonnees: sourceExtracts.length ? ['sources-officielles'] : [],
    });

    return { data: toolUse.input, raw: json, usage, model };
  }

  costReport() {
    return this.ledger.report();
  }
}
