import { renderTextToMinimalPdf } from '../lib/minimal-pdf.mjs';
import { renderSolidColorPng } from '../lib/minimal-png.mjs';

function extractSvgDimensions(svg) {
  const widthMatch = svg.match(/width="(\d+)"/);
  const heightMatch = svg.match(/height="(\d+)"/);
  return {
    width: widthMatch ? Number(widthMatch[1]) : 800,
    height: heightMatch ? Number(heightMatch[1]) : 450,
  };
}

function extractSvgBackground(svg) {
  const match = svg.match(/<rect[^>]*fill="([^"]+)"/);
  return match ? match[1] : '#e5e7eb';
}

/**
 * Renderer hors-ligne (RENDERER=fake) : ne lance aucun navigateur, aucun
 * appel reseau. Produit de vrais PDF/PNG decodables mais volontairement
 * simplifies (texte brut, aplat de couleur) — suffisant pour les lots 2/3
 * en test et en dry-run. Le RENDERER=playwright (reel) assure la fidelite
 * visuelle complete requise en production (lot 3).
 */
export class FakeRenderer {
  async renderHtmlToPdf({ html, title }) {
    return { buffer: renderTextToMinimalPdf(html, { title }), mimeType: 'application/pdf' };
  }

  async renderSvgToRaster({ svg, format = 'png' }) {
    const { width, height } = extractSvgDimensions(svg);
    const background = extractSvgBackground(svg);
    const buffer = renderSolidColorPng(width, height, background);
    // Le renderer hors-ligne ne sait produire que du PNG reel (aucune
    // dependance d'encodage WebP sans navigateur). Il retourne toujours des
    // octets PNG et signale honnetement le format reellement produit ;
    // seul RENDERER=playwright produit un veritable WebP (section 4.3).
    return { buffer, mimeType: 'image/png', format: 'png', requestedFormat: format };
  }
}
