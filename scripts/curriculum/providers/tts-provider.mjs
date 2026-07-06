// Interface commune TtsProvider (section 4.3, section 10 lot 2).
// Contrat : synthesize({script, voice, languageCode, speakingRate, pauses})
//   -> { buffer, mimeType, metadata }
// Selection : TTS_PROVIDER=google (defaut) | fake.

import { GoogleTtsProvider } from './google-tts.mjs';
import { FakeTtsProvider } from './fake-tts.mjs';

export function createTtsProvider(env = process.env) {
  const providerName = (env.TTS_PROVIDER ?? 'google').toLowerCase();

  if (providerName === 'fake') return new FakeTtsProvider();
  if (providerName === 'google') return new GoogleTtsProvider({ apiKey: env.GOOGLE_TTS_API_KEY });

  throw new Error(`TTS_PROVIDER inconnu : "${providerName}". Valeurs supportees : google, fake.`);
}
