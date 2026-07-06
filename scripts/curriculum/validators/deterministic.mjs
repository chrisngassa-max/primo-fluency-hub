import { hashContent } from '../lib/hash.mjs';

// Controle 1, deterministe (section 9.4). Aucune IA, aucun reseau : verifie
// des proprietes objectivement calculables sur le fichier et son
// descripteur. Retourne un rapport compatible avec validationReportSchema
// (validateur: 'deterministic').

const MAGIC_BYTES = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46], // %PDF
  'image/png': [0x89, 0x50, 0x4e, 0x47],
  'audio/mpeg': null, // pas de magic byte unique fiable (ID3 optionnel) ; verifie autrement
  'image/svg+xml': null,
  'application/json': null,
};

const FORBIDDEN_TEXT_PATTERNS = [
  { name: 'numero_telephone_francais', pattern: /\b0[1-9](?:[ .-]?\d{2}){4}\b/ },
  { name: 'adresse_email', pattern: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i },
  { name: 'mention_logo_officiel', pattern: /\blogo officiel\b/i },
  { name: 'mention_filigrane', pattern: /\bfiligrane\b/i },
];

function sniffMagicBytes(buffer, mimeType) {
  const magic = MAGIC_BYTES[mimeType];
  if (!magic) return true; // pas de signature verifiable pour ce type
  return magic.every((byte, index) => buffer[index] === byte);
}

function readPngDimensions(buffer) {
  if (buffer.length < 24) return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function scanForbiddenText(...texts) {
  const found = [];
  for (const text of texts.filter(Boolean)) {
    for (const { name, pattern } of FORBIDDEN_TEXT_PATTERNS) {
      if (pattern.test(text)) found.push(name);
    }
  }
  return [...new Set(found)];
}

/**
 * @param {{
 *   resource_id: string,
 *   kind: string,
 *   mimeType: string,
 *   requiredElements?: string[],
 *   altText?: string|null,
 *   transcript?: string|null,
 *   sourceIds?: string[],
 *   rightsStatus?: string,
 *   expectedHash?: string|null,
 *   expectedAspectRatio?: number|null,
 *   expectedDurationSeconds?: number|null,
 *   actualDurationSeconds?: number|null,
 *   expectedElementCount?: number|null,
 *   actualElementCount?: number|null,
 * }} descriptor
 * @param {Buffer} buffer
 * @param {{ knownHashes?: Set<string> }} context
 */
export function runDeterministicChecks(descriptor, buffer, context = {}) {
  const bloquants = [];
  const checks = {};

  checks.non_vide = buffer.length > 0;
  if (!checks.non_vide) bloquants.push('Ressource vide (0 octet) : aucune ressource obligatoire ne peut etre vide.');

  checks.mime_decodable = sniffMagicBytes(buffer, descriptor.mimeType);
  if (!checks.mime_decodable) {
    bloquants.push(`Fichier non decodable pour le MIME declare "${descriptor.mimeType}" (signature invalide).`);
  }

  const hash = hashContent(buffer);
  checks.hash = hash;
  if (descriptor.expectedHash && descriptor.expectedHash !== hash) {
    bloquants.push(`Hash inattendu : attendu ${descriptor.expectedHash}, obtenu ${hash}.`);
  }

  if (context.knownHashes?.has(hash)) {
    bloquants.push(`Doublon detecte : le hash ${hash} correspond a une ressource deja publiee.`);
  }
  checks.doublon = context.knownHashes?.has(hash) ?? false;

  // Uniquement sur le MIME reel (pas un prefixe de `kind`) : un descripteur
  // JSON de type "vis_brief_json" decrit une image sans en etre une, et ne
  // doit donc pas etre soumis a l'exigence d'alt_text.
  if (descriptor.mimeType?.startsWith('image/')) {
    if (!descriptor.altText || !descriptor.altText.trim()) {
      bloquants.push('alt_text manquant pour une ressource image.');
    }
  }

  // Restreint aux ressources qui portent reellement une piste audio ou sa
  // transcription synchronisee (pas tout ce qui commence par "co_", ce qui
  // capturerait a tort "corrige_json").
  if (descriptor.mimeType === 'audio/mpeg' || descriptor.kind === 'co_transcript') {
    if (!descriptor.transcript || !descriptor.transcript.trim()) {
      bloquants.push('transcription manquante pour une ressource audio.');
    }
  }

  if (descriptor.rightsStatus === 'official_source' && (!descriptor.sourceIds || descriptor.sourceIds.length === 0)) {
    bloquants.push('source_ids manquant pour une ressource rights_status=official_source.');
  }

  if (descriptor.mimeType === 'image/png') {
    const dimensions = readPngDimensions(buffer);
    checks.dimensions = dimensions;
    if (
      dimensions &&
      descriptor.expectedAspectRatio &&
      Math.abs(dimensions.width / dimensions.height - descriptor.expectedAspectRatio) > 0.05
    ) {
      bloquants.push(
        `Ratio d'image inattendu : ${(dimensions.width / dimensions.height).toFixed(2)} au lieu de ${descriptor.expectedAspectRatio}.`,
      );
    }
  }

  if (
    descriptor.expectedDurationSeconds != null &&
    descriptor.actualDurationSeconds != null &&
    Math.abs(descriptor.expectedDurationSeconds - descriptor.actualDurationSeconds) > Math.max(5, descriptor.expectedDurationSeconds * 0.15)
  ) {
    bloquants.push(
      `Duree audio hors tolerance : attendu ~${descriptor.expectedDurationSeconds}s, obtenu ${descriptor.actualDurationSeconds}s.`,
    );
  }

  if (
    descriptor.expectedElementCount != null &&
    descriptor.actualElementCount != null &&
    descriptor.expectedElementCount !== descriptor.actualElementCount
  ) {
    bloquants.push(
      `Compte d'elements incoherent : attendu ${descriptor.expectedElementCount}, trouve ${descriptor.actualElementCount}.`,
    );
  }

  const forbiddenMatches = scanForbiddenText(descriptor.altText, descriptor.transcript);
  checks.forbidden_text_matches = forbiddenMatches;
  if (forbiddenMatches.length > 0) {
    bloquants.push(`Motif interdit detecte dans le texte associe : ${forbiddenMatches.join(', ')}.`);
  }

  return {
    validateur: 'deterministic',
    modele: null,
    regles: [
      'non_vide',
      'mime_decodable',
      'hash_attendu',
      'doublon',
      'alt_text_present',
      'transcription_presente',
      'source_ids_presents',
      'ratio_image',
      'duree_audio',
      'compte_elements',
      'texte_interdit',
    ],
    scores: {},
    bloquants,
    rapport: { resource_id: descriptor.resource_id, kind: descriptor.kind, checks },
  };
}
