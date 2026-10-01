/** Structural contract of DevoirPassation + submit-devoir-result. No AI or scoring. */
export type HomeworkExercise = {
  titre?: unknown; consigne?: unknown; competence?: unknown; format?: unknown; contenu?: unknown;
};
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const record = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const formats = ['qcm', 'vrai_faux', 'appariement', 'texte_lacunaire', 'transformation', 'production_ecrite', 'production_orale'];
export function homeworkContentErrors(ex: HomeworkExercise, forCopy = false): string[] {
  const errors: string[] = [];
  const c = ex.contenu;
  if (!text(ex.titre) || !text(ex.consigne)) errors.push('Titre ou consigne manquant.');
  if (!['CE', 'CO', 'EE', 'EO', 'Structures'].includes(String(ex.competence))) errors.push('Compétence inconnue.');
  if (!formats.includes(String(ex.format))) errors.push('Format non pris en charge.');
  if (!record(c) || Object.keys(c).length === 0) return [...errors, 'Contenu incomplet : aucun contenu préparé.'];
  const image = c.image || c.image_url || c.visual || c.support_visuel || c.illustration || c.media_url;
  if (ex.competence === 'CE' && !text(c.texte) && !(text(image) && /^https?:\/\//.test(image))) errors.push('Support de lecture manquant.');
  const audio = record(c.audio) && text(c.audio.source_id) && text(c.audio.source_content_hash);
  const hasAudioReference = c.audio !== undefined && c.audio !== null;
  if (ex.competence === 'CO' && !(hasAudioReference ? audio : text(c.script_audio))) errors.push('Support audio manquant ou incomplet.');
  if (forCopy && ex.competence === 'CO' && hasAudioReference) errors.push('Audio original lié à sa publication : utilisez le chemin manuel pour cet exercice.');
  if (ex.competence === 'CO' && c.metadata?.source_stale === true) errors.push('Support audio à revalider.');
  if ((ex.competence === 'EE') !== (ex.format === 'production_ecrite') || (ex.competence === 'EO') !== (ex.format === 'production_orale')) errors.push('Format incompatible avec la compétence.');
  if (!Array.isArray(c.items) || c.items.length === 0) return [...errors, 'Contenu incomplet : aucune question préparée.'];
  if (ex.format === 'production_orale' && c.items.length !== 1) errors.push('La réponse orale nécessite une seule consigne.');
  c.items.forEach((item: unknown, i: number) => {
    const prefix = `Question ${i + 1} : `;
    if (!record(item) || !text(item.question)) { errors.push(prefix + 'question manquante.'); return; }
    const open = ex.format === 'production_ecrite' || ex.format === 'production_orale';
    if (item.options !== undefined && (!Array.isArray(item.options) || item.options.some((o: unknown) => !text(o)))) errors.push(prefix + 'options invalides.');
    const options: unknown[] = Array.isArray(item.options) ? item.options : [];
    if (open) {
      if (options.length) errors.push(prefix + 'une production libre ne doit pas proposer de choix.');
      return;
    }
    if (!text(item.bonne_reponse)) errors.push(prefix + 'réponse attendue manquante.');
    if (ex.format === 'qcm' && (options.length < 2 || new Set(options).size !== options.length)) errors.push(prefix + 'au moins deux choix distincts requis.');
    if (options.length && !options.includes(item.bonne_reponse)) errors.push(prefix + 'réponse absente des choix.');
    if (ex.format === 'vrai_faux' && !['vrai', 'faux', 'true', 'false'].includes(String(item.bonne_reponse).trim().toLowerCase())) errors.push(prefix + 'réponse vrai/faux invalide.');
    // The actual player renders matching/gap/transformation as one textual answer per item.
    // Nested pairs/arrays are not executable by that player and are rejected above.
  });
  return errors;
}
