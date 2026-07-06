import { withExponentialBackoff } from '../lib/retry.mjs';
import { hashContent } from '../lib/hash.mjs';

// TtsProvider reel (section 4.3) : Google Cloud Text-to-Speech reste le
// moteur maitre. Chaque MP3 conserve script, voix, vitesse, pauses, duree
// et hash (paquet obligatoire, section 5 : audio/CO-metadata.json).

const GOOGLE_TTS_ENDPOINT = 'https://texttospeech.googleapis.com/v1/text:synthesize';

function estimateDurationSeconds(script, speakingRate = 1) {
  const words = script.trim().split(/\s+/).filter(Boolean).length;
  const wordsPerMinuteAtRate1 = 140;
  const minutes = words / (wordsPerMinuteAtRate1 * speakingRate);
  return Math.round(minutes * 60);
}

export class GoogleTtsProvider {
  constructor({ apiKey, fetchImpl = fetch } = {}) {
    if (!apiKey) {
      throw new Error('GOOGLE_TTS_API_KEY est requis pour TTS_PROVIDER=google.');
    }
    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl;
  }

  /**
   * @param {{ script: string, voice?: string, languageCode?: string, speakingRate?: number, pauses?: Array<{after_word:number, ms:number}> }} request
   */
  async synthesize({ script, voice = 'fr-FR-Wavenet-C', languageCode = 'fr-FR', speakingRate = 1, pauses = [] }) {
    if (!script || !script.trim()) {
      throw new Error('google-tts: script vide refuse (aucun MP3 ne peut etre genere sans script fige).');
    }

    const ssml = this._toSsml(script, pauses);

    const response = await withExponentialBackoff(() =>
      this.fetchImpl(`${GOOGLE_TTS_ENDPOINT}?key=${encodeURIComponent(this.apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { ssml },
          voice: { languageCode, name: voice },
          audioConfig: { audioEncoding: 'MP3', speakingRate },
        }),
      }),
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google TTS error: ${response.status} - ${errorText.slice(0, 300)}`);
    }

    const json = await response.json();
    if (!json.audioContent) {
      throw new Error('Google TTS: reponse sans audioContent.');
    }

    const buffer = Buffer.from(json.audioContent, 'base64');

    return {
      buffer,
      mimeType: 'audio/mpeg',
      metadata: {
        provider: 'google-tts',
        script,
        transcript: script,
        voice,
        languageCode,
        speaking_rate: speakingRate,
        pauses,
        duration_seconds: estimateDurationSeconds(script, speakingRate),
        hash: hashContent(buffer),
      },
    };
  }

  _toSsml(script, pauses) {
    if (pauses.length === 0) return `<speak>${escapeXml(script)}</speak>`;

    const words = script.split(/\s+/);
    const pauseAfter = new Map(pauses.map((pause) => [pause.after_word, pause.ms]));
    const parts = words.map((word, index) => {
      const ms = pauseAfter.get(index);
      return ms ? `${escapeXml(word)}<break time="${ms}ms"/>` : escapeXml(word);
    });
    return `<speak>${parts.join(' ')}</speak>`;
  }
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
