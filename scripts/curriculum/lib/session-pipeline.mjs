import { hashContent } from './hash.mjs';
import { toYaml } from './yaml-lite.mjs';
import { assertVariantsShareInvariants, variantSchema } from '../schemas/variant.schema.mjs';

// Pipeline de production d'une seance (lot 3, section 9.2). Pur en
// entrees/sorties : ne touche jamais le disque ni la base — cela reste du
// ressort de la couche CLI (generate-batch.mjs), ce qui rend le pipeline
// testable avec des doubles de test sans I/O.
//
// Entree : { sessionCode, brief, providers: {contentProvider, imageProvider,
// ttsProvider, renderer} }
// Sortie : { supportHash, resources: Array<ResourceArtifact>, variantsList }
//
// ResourceArtifact = { resource_id, kind, mimeType, buffer, hash,
//   required_elements, source_ids, rights_status, alt_text, transcript,
//   depends_on_answer, dependencies, review_content }
// `review_content` (optionnel) porte les donnees a soumettre au controle 2
// (IA) quand la ressource merite une revue pedagogique (section 9.4).

const NIVEAUX = ['A1', 'A2', 'B1', 'B2'];

function jsonBuffer(data) {
  return Buffer.from(`${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function makeResource({
  resourceId,
  kind,
  mimeType,
  buffer,
  altText = null,
  transcript = null,
  requiredElements = [],
  forbiddenElements = [],
  sourceIds = [],
  rightsStatus = 'cap_tcf_created',
  generationMode = 'deterministic',
  dependsOnAnswer = false,
  dependencies = [],
  reviewContent = null,
}) {
  return {
    resource_id: resourceId,
    kind,
    mimeType,
    buffer,
    hash: hashContent(buffer),
    alt_text: altText,
    transcript,
    required_elements: requiredElements,
    forbidden_elements: forbiddenElements,
    source_ids: sourceIds,
    rights_status: rightsStatus,
    generation_mode: generationMode,
    depends_on_answer: dependsOnAnswer,
    dependencies,
    review_content: reviewContent,
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function htmlDocument(title, bodyHtml) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body>${bodyHtml}</body></html>`;
}

function buildSupportMasterHtml(sessionCode, brief) {
  return htmlDocument(`${sessionCode} — support maître`, [
    `<h1>${escapeHtml(brief.titre)}</h1>`,
    `<h2>Situation</h2><p>${escapeHtml(brief.support.situation)}</p>`,
    '<h2>Personnages</h2><ul>',
    ...brief.support.personnages.map((p) => `<li>${escapeHtml(p)}</li>`),
    '</ul>',
    '<h2>Faits invariants</h2><ul>',
    ...brief.support.faits.map((f) => `<li>${escapeHtml(f)}</li>`),
    '</ul>',
  ].join('\n'));
}

function buildTranscriptHtml(sessionCode, script) {
  const lines = script.split('\n').map((line) => `<p>${escapeHtml(line)}</p>`).join('\n');
  return htmlDocument(`${sessionCode} — transcription CO`, `<h1>Transcription</h1>${lines}`);
}

function buildLexiqueHtml(sessionCode, lexique) {
  const rows = lexique.mots
    .map((m) => `<li><strong>${escapeHtml(m.mot)}</strong> — ${escapeHtml(m.definition_simple)} <em>(${escapeHtml(m.exemple)})</em></li>`)
    .join('\n');
  return htmlDocument(`${sessionCode} — lexique A1-B2`, `<h1>Lexique</h1><ul>${rows}</ul>`);
}

function buildDevoirHtml(sessionCode, niveau, texte) {
  return htmlDocument(`${sessionCode} — devoir ${niveau}`, `<h1>Devoir ${niveau}</h1><p>${escapeHtml(texte)}</p>`);
}

function buildApprenantFicheHtml(sessionCode, niveau, brief, variant) {
  return htmlDocument(`${sessionCode} — fiche apprenant ${niveau}`, [
    `<h1>${escapeHtml(brief.titre)} — niveau ${niveau}</h1>`,
    `<p><strong>Consigne :</strong> ${escapeHtml(variant.consigne)}</p>`,
    variant.aides?.length ? `<p><strong>Aides :</strong> ${escapeHtml(variant.aides.join(' · '))}</p>` : '',
  ].join('\n'));
}

function buildFormateurHtml(sessionCode, brief) {
  const deroule = brief.formateur.deroule_180min
    .map((phase) => `<li><strong>${escapeHtml(phase.phase)}</strong> (${phase.duree_min} min) — ${escapeHtml(phase.description)}</li>`)
    .join('\n');
  const adaptations = brief.formateur.adaptation_rules.map((rule) => `<li>${escapeHtml(rule)}</li>`).join('\n');

  return htmlDocument(`${sessionCode} — fiche formateur`, [
    `<h1>Fiche formateur — ${escapeHtml(brief.titre)}</h1>`,
    `<p>${escapeHtml(brief.formateur.fiche_formateur)}</p>`,
    `<h2>Déroulé (180 min)</h2><ol>${deroule}</ol>`,
    `<h2>Règles d'adaptation</h2><ul>${adaptations}</ul>`,
  ].join('\n'));
}

/** Construit la liste des 4 variantes A1-B2 et verifie qu'elles partagent les memes invariants (section 12.1). */
function buildVariants(brief, supportHash) {
  const variantsList = NIVEAUX.map((niveau) => {
    const source = brief.variants[niveau];
    if (!source) throw new Error(`Variante manquante pour le niveau ${niveau}.`);
    return variantSchema.parse({
      support_id: brief.support.support_id,
      niveau,
      consigne: source.consigne,
      aides: source.aides ?? [],
      questions: source.questions,
      corrige: source.corrige,
      invariants_hash: supportHash,
    });
  });

  assertVariantsShareInvariants(variantsList);
  return variantsList;
}

export async function generateSessionPackage({ sessionCode, brief, providers }) {
  const { imageProvider, ttsProvider, renderer } = providers;
  const resources = [];

  const supportCanonical = {
    support_id: brief.support.support_id,
    personnages: brief.support.personnages,
    situation: brief.support.situation,
    faits: brief.support.faits,
    nombres: brief.support.nombres,
    dates: brief.support.dates,
  };
  const supportHash = hashContent(supportCanonical);

  resources.push(
    makeResource({
      resourceId: 'support-master-json',
      kind: 'support_master_json',
      mimeType: 'application/json',
      buffer: jsonBuffer({ ...supportCanonical, hash: supportHash, version: 1 }),
      sourceIds: brief.support.source_ids,
    }),
  );

  const supportHtml = buildSupportMasterHtml(sessionCode, brief);
  resources.push(
    makeResource({
      resourceId: 'support-master-html',
      kind: 'support_master_html',
      mimeType: 'text/html',
      buffer: Buffer.from(supportHtml, 'utf8'),
      generationMode: 'template',
      dependencies: ['support-master-json'],
    }),
  );

  const supportPdf = await renderer.renderHtmlToPdf({ html: supportHtml, title: `${sessionCode} — support maître` });
  resources.push(
    makeResource({
      resourceId: 'support-master-pdf',
      kind: 'support_master_pdf',
      mimeType: supportPdf.mimeType,
      buffer: supportPdf.buffer,
      generationMode: 'template',
      dependencies: ['support-master-html'],
    }),
  );

  const variantsList = buildVariants(brief, supportHash);
  resources.push(
    makeResource({
      resourceId: 'variantes-a1-a2-b1-b2',
      kind: 'variantes_json',
      mimeType: 'application/json',
      buffer: jsonBuffer(variantsList),
      dependencies: ['support-master-json'],
      reviewContent: variantsList,
    }),
  );

  resources.push(
    makeResource({
      resourceId: 'vis-brief-json',
      kind: 'vis_brief_json',
      mimeType: 'application/json',
      buffer: jsonBuffer({ resource_id: brief.visual.resource_id, scene: brief.visual.scene, alt_text: brief.visual.alt_text }),
      altText: brief.visual.alt_text,
      dependencies: ['support-master-json'],
    }),
  );

  const imageResult = await imageProvider.generate({ brief: { resource_id: brief.visual.resource_id }, scene: brief.visual.scene });
  resources.push(
    makeResource({
      resourceId: 'vis-master-svg',
      kind: 'vis_master_svg',
      mimeType: 'image/svg+xml',
      buffer: Buffer.from(imageResult.svg, 'utf8'),
      altText: brief.visual.alt_text,
      forbiddenElements: ['logo', 'map', 'official_document', 'real_photo'],
      dependencies: ['vis-brief-json'],
      reviewContent: { svg: imageResult.svg, alt_text: brief.visual.alt_text },
    }),
  );

  const png = await renderer.renderSvgToRaster({ svg: imageResult.svg, format: 'png' });
  resources.push(
    makeResource({
      resourceId: 'vis-master-png',
      kind: 'vis_master_png',
      mimeType: png.mimeType,
      buffer: png.buffer,
      altText: brief.visual.alt_text,
      dependencies: ['vis-master-svg'],
    }),
  );

  const webp = await renderer.renderSvgToRaster({ svg: imageResult.svg, format: 'webp' });
  resources.push(
    makeResource({
      resourceId: 'vis-master-webp',
      kind: 'vis_master_webp',
      mimeType: webp.mimeType,
      buffer: webp.buffer,
      altText: brief.visual.alt_text,
      dependencies: ['vis-master-svg'],
    }),
  );

  const audio = await ttsProvider.synthesize({
    script: brief.co.script,
    voice: brief.co.voice,
    speakingRate: brief.co.speaking_rate,
    pauses: brief.co.pauses,
  });

  resources.push(makeResource({ resourceId: 'co-script-md', kind: 'co_script', mimeType: 'text/markdown', buffer: Buffer.from(brief.co.script, 'utf8') }));

  const transcriptHtml = buildTranscriptHtml(sessionCode, brief.co.script);
  const transcriptPdf = await renderer.renderHtmlToPdf({ html: transcriptHtml, title: `${sessionCode} — transcription CO` });
  resources.push(
    makeResource({
      resourceId: 'co-transcript-pdf',
      kind: 'co_transcript',
      mimeType: transcriptPdf.mimeType,
      buffer: transcriptPdf.buffer,
      transcript: brief.co.script,
      generationMode: 'template',
      dependencies: ['co-script-md'],
    }),
  );

  resources.push(
    makeResource({
      resourceId: 'co-master-mp3',
      kind: 'co_master',
      mimeType: audio.mimeType,
      buffer: audio.buffer,
      transcript: brief.co.script,
      generationMode: 'tts',
      dependencies: ['co-script-md'],
    }),
  );
  resources.push(
    makeResource({
      resourceId: 'co-metadata-json',
      kind: 'co_metadata',
      mimeType: 'application/json',
      buffer: jsonBuffer(audio.metadata),
      generationMode: 'tts',
      dependencies: ['co-master-mp3'],
    }),
  );

  resources.push(
    makeResource({ resourceId: 'lexique-a1-b2-json', kind: 'lexique_json', mimeType: 'application/json', buffer: jsonBuffer(brief.lexique) }),
  );
  const lexiqueHtml = buildLexiqueHtml(sessionCode, brief.lexique);
  const lexiquePdf = await renderer.renderHtmlToPdf({ html: lexiqueHtml, title: `${sessionCode} — lexique` });
  resources.push(
    makeResource({
      resourceId: 'lexique-a1-b2-pdf',
      kind: 'lexique_pdf',
      mimeType: lexiquePdf.mimeType,
      buffer: lexiquePdf.buffer,
      generationMode: 'template',
      dependencies: ['lexique-a1-b2-json'],
    }),
  );

  resources.push(
    makeResource({
      resourceId: 'exercices-json',
      kind: 'exercices_json',
      mimeType: 'application/json',
      buffer: jsonBuffer({
        session_code: sessionCode,
        variants: variantsList.map((v) => ({ niveau: v.niveau, consigne: v.consigne, aides: v.aides, questions: v.questions })),
      }),
      dependencies: ['variantes-a1-a2-b1-b2'],
      reviewContent: variantsList.map((v) => ({ niveau: v.niveau, consigne: v.consigne, questions: v.questions })),
    }),
  );

  resources.push(
    makeResource({
      resourceId: 'corrige-json',
      kind: 'corrige_json',
      mimeType: 'application/json',
      buffer: jsonBuffer(Object.fromEntries(variantsList.map((v) => [v.niveau, v.corrige]))),
      dependsOnAnswer: true,
      dependencies: ['exercices-json'],
    }),
  );

  resources.push(
    makeResource({
      resourceId: 'qcm-civique-json',
      kind: 'qcm_civique_json',
      mimeType: 'application/json',
      buffer: jsonBuffer(brief.civic_qcm),
      reviewContent: brief.civic_qcm,
      dependsOnAnswer: true,
    }),
  );

  for (const niveau of NIVEAUX) {
    const devoirHtml = buildDevoirHtml(sessionCode, niveau, brief.devoirs[niveau]);
    const devoirPdf = await renderer.renderHtmlToPdf({ html: devoirHtml, title: `${sessionCode} — devoir ${niveau}` });
    resources.push(
      makeResource({
        resourceId: `devoir-${niveau.toLowerCase()}-pdf`,
        kind: 'devoir_pdf',
        mimeType: devoirPdf.mimeType,
        buffer: devoirPdf.buffer,
        generationMode: 'template',
        dependencies: ['exercices-json'],
      }),
    );

    const variant = variantsList.find((v) => v.niveau === niveau);
    const ficheHtml = buildApprenantFicheHtml(sessionCode, niveau, brief, variant);
    const fichePdf = await renderer.renderHtmlToPdf({ html: ficheHtml, title: `${sessionCode} — fiche apprenant ${niveau}` });
    resources.push(
      makeResource({
        resourceId: `fiche-${niveau.toLowerCase()}-pdf`,
        kind: 'fiche_apprenant_pdf',
        mimeType: fichePdf.mimeType,
        buffer: fichePdf.buffer,
        generationMode: 'template',
        dependencies: ['variantes-a1-a2-b1-b2'],
      }),
    );
  }

  const formateurHtml = buildFormateurHtml(sessionCode, brief);
  const formateurPdf = await renderer.renderHtmlToPdf({ html: formateurHtml, title: `${sessionCode} — fiche formateur` });
  resources.push(
    makeResource({
      resourceId: 'fiche-formateur-pdf',
      kind: 'fiche_formateur_pdf',
      mimeType: formateurPdf.mimeType,
      buffer: formateurPdf.buffer,
      generationMode: 'template',
    }),
  );
  resources.push(
    makeResource({ resourceId: 'deroule-180min-json', kind: 'deroule_json', mimeType: 'application/json', buffer: jsonBuffer(brief.formateur.deroule_180min) }),
  );
  resources.push(
    makeResource({
      resourceId: 'adaptation-rules-json',
      kind: 'adaptation_rules_json',
      mimeType: 'application/json',
      buffer: jsonBuffer(brief.formateur.adaptation_rules),
    }),
  );

  resources.push(
    makeResource({ resourceId: 'sources-json', kind: 'sources_json', mimeType: 'application/json', buffer: jsonBuffer({ source_ids: brief.support.source_ids ?? [] }) }),
  );

  const sessionYaml = toYaml({
    session_code: sessionCode,
    titre: brief.titre,
    plan_version: brief.plan_version,
    support_id: brief.support.support_id,
    support_hash: supportHash,
    resources: resources.map((r) => r.resource_id),
  });
  resources.push(makeResource({ resourceId: 'session-yaml', kind: 'session_yaml', mimeType: 'text/yaml', buffer: Buffer.from(sessionYaml, 'utf8') }));

  return { sessionCode, supportHash, variantsList, resources };
}
