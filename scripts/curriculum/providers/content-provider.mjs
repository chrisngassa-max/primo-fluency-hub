// Interface commune ContentProvider (section 10, lot 2).
//
// Contrat :
//   generateStructured({ promptVersion, systemPrompt, userPrompt, schema, sourceExtracts })
//     -> { data: <objet conforme a `schema`>, raw, usage: {inputTokens, outputTokens}, model }
//   review({ promptVersion, content, rubric, sourceExtracts })
//     -> { data: <objet conforme au schema de revue>, raw, usage, model }
//
// `schema` est un schema Zod : la sortie est validee et rejetee (exception)
// si elle ne correspond pas (section 9.2 : "toute sortie invalide est
// rejetee avant stockage").
//
// Selection : CONTENT_PROVIDER=anthropic (defaut) | fake. Le mode `fake`
// n'est jamais choisi implicitement (pas de repli silencieux si la cle API
// manque) : il doit etre demande explicitement, pour eviter de publier du
// contenu factice en production.

import { AnthropicContentProvider } from './anthropic-content.mjs';
import { FakeContentProvider } from './fake-content.mjs';

export function createContentProvider(env = process.env) {
  const providerName = (env.CONTENT_PROVIDER ?? 'anthropic').toLowerCase();

  if (providerName === 'fake') {
    return new FakeContentProvider();
  }

  if (providerName === 'anthropic') {
    return new AnthropicContentProvider({
      apiKey: env.ANTHROPIC_API_KEY,
      contentModel: env.ANTHROPIC_CONTENT_MODEL,
      reviewModel: env.ANTHROPIC_REVIEW_MODEL,
      maxTokens: env.ANTHROPIC_MAX_TOKENS ? Number(env.ANTHROPIC_MAX_TOKENS) : undefined,
      maxCostEur: env.ANTHROPIC_MAX_COST_EUR ? Number(env.ANTHROPIC_MAX_COST_EUR) : null,
    });
  }

  throw new Error(`CONTENT_PROVIDER inconnu : "${providerName}". Valeurs supportees : anthropic, fake.`);
}
