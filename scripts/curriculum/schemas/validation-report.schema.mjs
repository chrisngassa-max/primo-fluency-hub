import { z } from 'zod';

// Section 9.4 : double controle (deterministe puis IA de revue). Le
// schema valide seulement la forme du rapport ; la regle metier "quality
// score >= 4/5 et zero bloquant pour publier" vit dans les validateurs
// (scripts/curriculum/validators/*), pas ici.
export const validationReportSchema = z
  .object({
    validateur: z.enum(['deterministic', 'ai_review']),
    modele: z.string().min(1).nullable().default(null),
    regles: z.array(z.string()).default([]),
    scores: z
      .object({
        quality_score: z.number().min(0).max(5).nullable().default(null),
        pedagogical_relevance_score: z.number().min(0).max(5).nullable().default(null),
      })
      .partial()
      .default({}),
    bloquants: z.array(z.string()).default([]),
    rapport: z.record(z.string(), z.unknown()).default({}),
  })
  .strict()
  .superRefine((report, ctx) => {
    if (report.validateur === 'ai_review' && !report.modele) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'modele est obligatoire pour un rapport de validation ai_review.',
        path: ['modele'],
      });
    }
  });

/** Section 9.4 : "quality_score au moins 4/5", "pedagogical_relevance_score au moins 4/5", "zero bloquant". */
export function isPublishableReport(report) {
  if (report.bloquants.length > 0) return false;
  if (report.validateur !== 'ai_review') return true;
  const { quality_score, pedagogical_relevance_score } = report.scores ?? {};
  return (quality_score ?? 0) >= 4 && (pedagogical_relevance_score ?? 0) >= 4;
}
