import { withExponentialBackoff } from '../lib/retry.mjs';

// ImageProvider "voie optionnelle" alternative (section 4.2). Adaptateur
// autour de l'API Images d'OpenAI, meme contrat que GeminiImageProvider.

const OPENAI_IMAGES_ENDPOINT = 'https://api.openai.com/v1/images/generations';
const DEFAULT_MODEL = 'gpt-image-1';

export class OpenAiImageProvider {
  constructor({ apiKey, model = DEFAULT_MODEL, fetchImpl = fetch } = {}) {
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY est requis pour IMAGE_PROVIDER=openai.');
    }
    this.apiKey = apiKey;
    this.model = model;
    this.fetchImpl = fetchImpl;
  }

  /** @param {{ brief: { resource_id: string }, prompt: string }} request */
  async generate({ brief, prompt }) {
    const response = await withExponentialBackoff(() =>
      this.fetchImpl(OPENAI_IMAGES_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ model: this.model, prompt, size: '1024x1024' }),
      }),
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI images error for ${brief?.resource_id}: ${response.status} - ${errorText.slice(0, 300)}`);
    }

    const json = await response.json();
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) {
      throw new Error(`OpenAI n'a pas retourne d'image (b64_json) pour ${brief?.resource_id}.`);
    }

    return {
      kind: 'raster',
      buffer: Buffer.from(b64, 'base64'),
      mimeType: 'image/png',
      metadata: {
        provider: 'openai',
        generation_mode: 'raster_provider',
        model: this.model,
        resource_id: brief?.resource_id ?? null,
        prompt,
      },
    };
  }
}
