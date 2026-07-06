// Interface commune Renderer (section 4.4, 10 lot 2).
// Contrat :
//   renderHtmlToPdf({html, title}) -> { buffer, mimeType }
//   renderSvgToRaster({svg, format:'png'|'webp'}) -> { buffer, mimeType, format }
// Selection : RENDERER=playwright (defaut, reel) | fake (hors-ligne, tests).

import { PlaywrightRenderer } from './playwright-renderer.mjs';
import { FakeRenderer } from './fake-renderer.mjs';

export function createRenderer(env = process.env) {
  const rendererName = (env.RENDERER ?? 'playwright').toLowerCase();

  if (rendererName === 'fake') return new FakeRenderer();
  if (rendererName === 'playwright') return new PlaywrightRenderer();

  throw new Error(`RENDERER inconnu : "${rendererName}". Valeurs supportees : playwright, fake.`);
}
