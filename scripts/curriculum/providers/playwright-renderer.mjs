// Renderer reel : HTML -> PDF et SVG -> PNG/WebP via Chromium headless
// (Playwright, deja utilise par les tests e2e du depot). Aucun service
// tiers : le rendu reste deterministe (memes octets en entree -> meme
// document/image en sortie), conformement a la section 4.2 ("rendu
// deterministe SVG/HTML/Canvas depuis des donnees validees").

let chromiumModulePromise;
async function loadChromium() {
  if (!chromiumModulePromise) {
    chromiumModulePromise = import('@playwright/test').then((mod) => mod.chromium);
  }
  return chromiumModulePromise;
}

export class PlaywrightRenderer {
  async renderHtmlToPdf({ html, title = 'CapTCF', printBackground = true }) {
    const chromium = await loadChromium();
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      await page.setContent(`<html><head><title>${title}</title></head><body>${html}</body></html>`, {
        waitUntil: 'networkidle',
      });
      const buffer = await page.pdf({ format: 'A4', printBackground });
      return { buffer, mimeType: 'application/pdf' };
    } finally {
      await browser.close();
    }
  }

  async renderSvgToRaster({ svg, format = 'png', width, height }) {
    const chromium = await loadChromium();
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      await page.setContent(
        `<html><body style="margin:0;padding:0;">${svg}</body></html>`,
        { waitUntil: 'networkidle' },
      );
      const svgElement = await page.$('svg');
      if (!svgElement) {
        throw new Error('playwright-renderer: aucun element <svg> trouve dans le fragment fourni.');
      }

      const type = format === 'webp' ? undefined : format;
      const buffer = await svgElement.screenshot(
        type ? { type } : { type: 'png' },
      );

      if (format === 'webp') {
        const webpBuffer = await page.evaluate(async (pngBase64) => {
          const img = await new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = reject;
            image.src = `data:image/png;base64,${pngBase64}`;
          });
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          canvas.getContext('2d').drawImage(img, 0, 0);
          return canvas.toDataURL('image/webp').split(',')[1];
        }, buffer.toString('base64'));

        return { buffer: Buffer.from(webpBuffer, 'base64'), mimeType: 'image/webp', format: 'webp' };
      }

      return { buffer, mimeType: 'image/png', format: 'png' };
    } finally {
      await browser.close();
    }
  }
}
