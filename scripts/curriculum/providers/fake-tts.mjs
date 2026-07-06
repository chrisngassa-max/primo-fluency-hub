import { hashContent } from '../lib/hash.mjs';

// TtsProvider de test : aucun appel reseau. Produit un buffer deterministe
// (pas un vrai MP3 decodable) suffisant pour exercer le pipeline et les
// controles de traçabilite (script, hash, metadonnees) hors-ligne.
export class FakeTtsProvider {
  async synthesize({ script, voice = 'fake-voice', languageCode = 'fr-FR', speakingRate = 1, pauses = [] }) {
    if (!script || !script.trim()) {
      throw new Error('fake-tts: script vide refuse.');
    }

    const buffer = Buffer.from(`FAKE-MP3::${script}`, 'utf8');

    return {
      buffer,
      mimeType: 'audio/mpeg',
      metadata: {
        provider: 'fake-tts',
        script,
        transcript: script,
        voice,
        languageCode,
        speaking_rate: speakingRate,
        pauses,
        duration_seconds: Math.max(1, Math.round(script.split(/\s+/).length / 2)),
        hash: hashContent(buffer),
      },
    };
  }
}
