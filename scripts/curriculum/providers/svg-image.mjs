// ImageProvider "voie prioritaire" (section 4.2) : rendu deterministe
// SVG/HTML/Canvas depuis des donnees validees. Aucun appel reseau, aucun
// hasard : la meme `scene` produit toujours le meme SVG (meme hash).

const FORBIDDEN_ELEMENT_TYPES = new Set(['logo', 'map', 'official_document', 'real_photo']);

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function renderElement(element) {
  switch (element.type) {
    case 'rect':
      return `<rect x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" fill="${escapeXml(element.fill ?? '#e5e7eb')}" rx="${element.rx ?? 0}" />`;
    case 'circle':
      return `<circle cx="${element.cx}" cy="${element.cy}" r="${element.r}" fill="${escapeXml(element.fill ?? '#e5e7eb')}" />`;
    case 'line':
      return `<line x1="${element.x1}" y1="${element.y1}" x2="${element.x2}" y2="${element.y2}" stroke="${escapeXml(element.stroke ?? '#374151')}" stroke-width="${element.strokeWidth ?? 2}" />`;
    case 'text':
      return `<text x="${element.x}" y="${element.y}" font-size="${element.fontSize ?? 16}" font-family="sans-serif" fill="${escapeXml(element.fill ?? '#111827')}" text-anchor="${element.anchor ?? 'start'}">${escapeXml(element.text)}</text>`;
    default:
      throw new Error(`svg-image: type d'element non supporte "${element.type}".`);
  }
}

/**
 * @param {{ width:number, height:number, background?:string, title:string, elements: Array<object> }} scene
 */
export function assertSceneAllowed(scene) {
  const problems = [];

  for (const element of scene.elements ?? []) {
    if (FORBIDDEN_ELEMENT_TYPES.has(element.type)) {
      problems.push(`Element interdit en generation libre : "${element.type}" (section 4.2).`);
    }
  }

  if (!scene.title || !scene.title.trim()) {
    problems.push('scene.title est obligatoire (utilise comme alt_text de base).');
  }

  return problems;
}

export class SvgImageProvider {
  /** @param {{brief: object, scene: object}} request */
  async generate({ brief, scene }) {
    const problems = assertSceneAllowed(scene);
    if (problems.length > 0) {
      throw new Error(`svg-image: scene refusee -> ${problems.join(' | ')}`);
    }

    const width = scene.width ?? 800;
    const height = scene.height ?? 450;
    const background = scene.background ?? '#ffffff';
    const elementsMarkup = (scene.elements ?? []).map(renderElement).join('\n  ');

    const svg = [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${escapeXml(scene.title)}">`,
      `  <title>${escapeXml(scene.title)}</title>`,
      `  <rect x="0" y="0" width="${width}" height="${height}" fill="${escapeXml(background)}" />`,
      `  ${elementsMarkup}`,
      '</svg>',
    ].join('\n');

    return {
      kind: 'svg',
      svg,
      mimeType: 'image/svg+xml',
      metadata: {
        provider: 'svg',
        generation_mode: 'deterministic',
        resource_id: brief?.resource_id ?? null,
        width,
        height,
      },
    };
  }
}
