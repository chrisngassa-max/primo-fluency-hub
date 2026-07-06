// Utilitaire de rendu autonome (section 11) â€” utile pour verifier
// rapidement un template HTML ou une scene SVG sans lancer tout le
// pipeline de seance :
//
//   node scripts/curriculum/render-documents.mjs --html fichier.html --out fichier.pdf
//   node scripts/curriculum/render-documents.mjs --svg fichier.svg --out fichier.png --format png
//
// Utilise le Renderer selectionne par RENDERER=playwright|fake (defaut
// playwright, section 4.4). Le pipeline de seance (session-pipeline.mjs)
// appelle directement le Renderer et n'a pas besoin de ce script ; celui-ci
// sert au debogage manuel d'un template isole.

import { readFile, writeFile } from 'node:fs/promises';
import { createRenderer } from './providers/renderer.mjs';
import { valueAfter, isMainModule } from './lib/cli-args.mjs';

async function main() {
  const args = process.argv.slice(2);
  const htmlPath = valueAfter(args, '--html');
  const svgPath = valueAfter(args, '--svg');
  const outPath = valueAfter(args, '--out');
  const format = valueAfter(args, '--format', 'png');

  if (!outPath || (!htmlPath && !svgPath)) {
    console.error('Usage : render-documents.mjs (--html <fichier> | --svg <fichier>) --out <fichier> [--format png|webp]');
    process.exitCode = 1;
    return;
  }

  const renderer = createRenderer();

  if (htmlPath) {
    const html = await readFile(htmlPath, 'utf8');
    const { buffer } = await renderer.renderHtmlToPdf({ html, title: htmlPath });
    await writeFile(outPath, buffer);
    console.log(`PDF Ã©crit : ${outPath} (${buffer.length} octets).`);
    return;
  }

  const svg = await readFile(svgPath, 'utf8');
  const { buffer, mimeType } = await renderer.renderSvgToRaster({ svg, format });
  await writeFile(outPath, buffer);
  console.log(`Image Ã©crite : ${outPath} (${mimeType}, ${buffer.length} octets).`);
}

if (isMainModule(import.meta.url)) {
  main().catch((error) => {
    console.error('Erreur inattendue pendant render-documents :', error);
    process.exitCode = 1;
  });
}
