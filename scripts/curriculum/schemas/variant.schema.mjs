import { z } from 'zod';
import { NIVEAUX } from './constants.mjs';

const questionSchema = z
  .object({
    id: z.string().min(1),
    type: z.string().min(1),
    enonce: z.string().min(1),
    options: z.array(z.string()).optional(),
  })
  .passthrough();

// Section 8.1 (exercise_variants) + section 5 (montee A1->B2 sans
// modifier les invariants). Le hash des invariants permet de detecter
// automatiquement une variante qui aurait altere le support-master
// (section 12.1 : "detection d'une variante qui modifie le support").
export const variantSchema = z
  .object({
    support_id: z.string().min(1),
    version: z.number().int().positive().default(1),
    niveau: z.enum(NIVEAUX),
    consigne: z.string().min(1),
    aides: z.array(z.string()).default([]),
    questions: z.array(questionSchema).min(1),
    corrige: z.record(z.string(), z.unknown()).or(z.array(z.unknown())),
    invariants_hash: z.string().min(1),
  })
  .strict();

/**
 * Verifie que les quatre traitements A1/A2/B1/B2 partagent le meme hash
 * d'invariants (personnages, faits, nombres, dates, media, source).
 * Toute divergence signale une variante qui a modifie le support (interdit
 * par la section 1.1 et le lot 4 : "Bloquer toute variante qui modifie les
 * faits, dates, nombres, personnes ou medias").
 */
export function assertVariantsShareInvariants(variants) {
  const hashes = new Set(variants.map((variant) => variant.invariants_hash));
  if (hashes.size > 1) {
    throw new Error(
      `Les variantes du support ${variants[0]?.support_id ?? '?'} ont des invariants_hash differents : ${[...hashes].join(', ')}`,
    );
  }
  return true;
}
