// Interface commune ImageProvider (section 4.2, section 10 lot 2).
//
// Contrat : generate({ brief, scene?, prompt? }) -> {
//   kind: 'svg' | 'raster',
//   svg?: string, buffer?: Buffer, mimeType: string,
//   metadata: { provider, generation_mode, resource_id, ... },
// }
//
// Selection via IMAGE_PROVIDER=svg|gemini|openai|disabled (section 4.2).
// `svg` est la voie prioritaire et le defaut : elle ne requiert aucune cle
// API et fonctionne toujours, meme si seul Anthropic est configure.

import { SvgImageProvider } from './svg-image.mjs';
import { GeminiImageProvider } from './gemini-image.mjs';
import { OpenAiImageProvider } from './openai-image.mjs';
import { DisabledImageProvider } from './disabled-image.mjs';

export function createImageProvider(env = process.env) {
  const providerName = (env.IMAGE_PROVIDER ?? 'svg').toLowerCase();

  switch (providerName) {
    case 'svg':
      return new SvgImageProvider();
    case 'gemini':
      return new GeminiImageProvider({ apiKey: env.GEMINI_API_KEY, model: env.IMAGE_MODEL });
    case 'openai':
      return new OpenAiImageProvider({ apiKey: env.OPENAI_API_KEY, model: env.IMAGE_MODEL });
    case 'disabled':
      return new DisabledImageProvider();
    default:
      throw new Error(`IMAGE_PROVIDER inconnu : "${providerName}". Valeurs supportees : svg, gemini, openai, disabled.`);
  }
}
