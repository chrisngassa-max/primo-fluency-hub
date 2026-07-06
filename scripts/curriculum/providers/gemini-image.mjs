import { withExponentialBackoff } from '../lib/retry.mjs';

// ImageProvider "voie optionnelle" (section 4.2) : scene generique
// photorealiste via Gemini. Adaptateur autour de l'API Gemini
// generateContent (images inline) ; anciennement duplique dans
// scripts/generate-pedagogical-images-gemini.mjs, desormais partage.

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-2.5-flash-image';

export function buildGeminiPrompt(promptText) {
  return [
    promptText,
    '',
    'Pedagogical constraints:',
    '- Use realistic documentary photography, suitable for adult FLE / TCF IRN exercises.',
    '- Avoid brands, watermarks, official emblems, real addresses, real phone numbers, real names, and real personal data.',
    '- If text is visible, keep it short, simple, and intentionally fictitious.',
    '- Prefer clear composition, natural light, and a horizontal 16:9 frame unless the scene explicitly requires otherwise.',
  ].join('\n');
}

export function extractInlineImage(responseJson) {
  const candidates = responseJson?.candidates ?? [];
  for (const candidate of candidates) {
    const parts = candidate?.content?.parts ?? [];
    for (const part of parts) {
      const inlineData = part.inlineData ?? part.inline_data;
      if (!inlineData?.data) continue;
      return { data: inlineData.data, mimeType: inlineData.mimeType ?? inlineData.mime_type ?? 'image/png' };
    }
  }
  return null;
}

export class GeminiImageProvider {
  constructor({ apiKey, model = DEFAULT_MODEL, fetchImpl = fetch } = {}) {
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY est requis pour IMAGE_PROVIDER=gemini.');
    }
    this.apiKey = apiKey;
    this.model = model;
    this.fetchImpl = fetchImpl;
  }

  /**
   * @param {{ brief: { resource_id: string, fallback_svg_required?: boolean }, prompt: string }} request
   */
  async generate({ brief, prompt }) {
    const fullPrompt = buildGeminiPrompt(prompt);

    const response = await withExponentialBackoff(() =>
      this.fetchImpl(`${GEMINI_ENDPOINT}/${this.model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
        }),
      }),
    );

    const bodyText = await response.text();
    let bodyJson;
    try {
      bodyJson = JSON.parse(bodyText);
    } catch {
      throw new Error(`Gemini a renvoye une reponse non-JSON pour ${brief?.resource_id}: ${bodyText.slice(0, 300)}`);
    }

    if (!response.ok) {
      const message = bodyJson?.error?.message ?? bodyText.slice(0, 300);
      throw new Error(`Gemini error for ${brief?.resource_id}: ${response.status} ${response.statusText} - ${message}`);
    }

    const inlineImage = extractInlineImage(bodyJson);
    if (!inlineImage) {
      throw new Error(`Gemini n'a pas retourne d'image inline pour ${brief?.resource_id}.`);
    }

    return {
      kind: 'raster',
      buffer: Buffer.from(inlineImage.data, 'base64'),
      mimeType: inlineImage.mimeType,
      metadata: {
        provider: 'gemini',
        generation_mode: 'raster_provider',
        model: this.model,
        resource_id: brief?.resource_id ?? null,
        prompt: fullPrompt,
      },
    };
  }
}
