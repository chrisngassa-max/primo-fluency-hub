// Encodeur PDF minimal, sans dependance externe. Utilise par le Renderer
// hors-ligne (fake-renderer.mjs) pour produire un vrai PDF valide (avec
// table xref correcte) a partir d'un texte simple, sans navigateur ni
// reseau. Le rendu HTML->PDF haute fidelite (lot 3) passe par le Renderer
// reel (Playwright).

function escapePdfText(text) {
  return String(text).replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
}

function stripHtml(html) {
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function wrapLines(text, maxCharsPerLine = 90) {
  const words = text.split(' ').filter(Boolean);
  const lines = [];
  let current = '';

  for (const word of words) {
    if ((current + ' ' + word).trim().length > maxCharsPerLine) {
      if (current) lines.push(current.trim());
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
  }
  if (current) lines.push(current.trim());
  return lines;
}

/**
 * Genere un PDF mono-page minimal mais structurellement valide (table xref
 * correcte) a partir d'un texte brut ou d'un fragment HTML (les balises
 * sont retirees ; le rendu HTML fidele est du ressort du Renderer reel).
 */
export function renderTextToMinimalPdf(source, { title = 'CapTCF' } = {}) {
  const text = stripHtml(source);
  const lines = wrapLines(text || title).slice(0, 55);

  const contentLines = lines
    .map((line, index) => (index === 0 ? `(${escapePdfText(line)}) Tj` : `0 -14 Td (${escapePdfText(line)}) Tj`))
    .join('\n');

  const streamBody = ['BT', '/F1 12 Tf', '72 740 Td', contentLines || `(${escapePdfText(title)}) Tj`, 'ET'].join('\n');
  const streamBytes = Buffer.from(streamBody, 'utf8');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    null, // object 5 (stream) built below
  ];

  const parts = ['%PDF-1.4\n'];
  const offsets = [];
  let cursor = Buffer.byteLength(parts[0], 'utf8');

  for (let i = 0; i < objects.length; i += 1) {
    const objNum = i + 1;
    offsets.push(cursor);

    let objectString;
    if (objNum === 5) {
      objectString = `${objNum} 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n${streamBody}\nendstream\nendobj\n`;
    } else {
      objectString = `${objNum} 0 obj\n${objects[i]}\nendobj\n`;
    }

    parts.push(objectString);
    cursor += Buffer.byteLength(objectString, 'utf8');
  }

  const xrefOffset = cursor;
  const xrefEntries = offsets
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('');

  parts.push(
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${xrefEntries}` +
      `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
  );

  return Buffer.from(parts.join(''), 'utf8');
}
