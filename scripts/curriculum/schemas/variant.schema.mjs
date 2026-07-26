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

const lessonSchema = z
  .object({
    title: z.string().min(2),
    objective: z.string().min(5),
    explanation: z.string().min(10),
    key_points: z.array(z.string().min(2)).min(1),
    examples: z.array(z.string().min(2)).min(1),
    estimated_minutes: z.number().positive(),
  })
  .strict();

const learningStepSchema = z
  .object({
    step_id: z.string().min(1),
    title: z.string().min(2),
    instruction: z.string().min(2),
    kind: z.enum(['guided', 'practice', 'transfer', 'extension', 'remediation']),
    estimated_minutes: z.number().positive(),
    homework_eligible: z.boolean().optional(),
    questions: z.array(questionSchema).min(1),
    corrige: z.record(z.string(), z.unknown()).or(z.array(z.unknown())),
  })
  .strict();

const learningPathSchema = z
  .object({
    lesson: lessonSchema,
    steps: z.array(learningStepSchema).min(2),
    adaptive_policy: z
      .object({
        remediation_below: z.number().min(0).max(100),
        consolidation_from: z.number().min(0).max(100),
        extension_from: z.number().min(0).max(100),
      })
      .strict(),
  })
  .strict();

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
    learning_path: learningPathSchema.optional(),
  })
  .strict()
  .superRefine((variant, ctx) => {
    if (variant.version >= 3 && !variant.learning_path) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['learning_path'],
        message: 'DIFF_LEARNING_PATH_MISSING: toute variante v3+ doit fournir une lecon et un parcours progressif.',
      });
    }
  });

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
