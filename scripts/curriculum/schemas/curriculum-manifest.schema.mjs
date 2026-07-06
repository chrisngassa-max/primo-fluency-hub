import { z } from 'zod';
import {
  CIVIC_MENTIONS,
  COMPETENCES,
  CURRICULUM_RESOURCE_STATUSES,
  MODULES,
  PALIERS,
  SESSION_KINDS,
  TOTAL_ENTRY_COUNT,
} from './constants.mjs';
import { validateCumulativeHours } from '../lib/hours.mjs';

// Registre racine content/curriculum/v2/manifest.json (lot 1). Liste
// S01-S37 + E1-E4 sans decrire encore le paquet complet de fichiers de
// chaque seance (cela releve du manifeste de seance, section 8.3, et des
// lots 3/4). Voir section 10, lot 1 : "Créer content/curriculum/v2/
// manifest.json listant S01–S37 et E1–E4."
export const manifestEntrySchema = z
  .object({
    session_code: z.string().regex(/^(S[0-3][0-9]|E[1-4])$/),
    ordre: z.number().int().positive(),
    kind: z.enum(SESSION_KINDS),
    module: z.enum(MODULES).nullable().default(null),
    palier: z.enum(PALIERS),
    type_seance: z.string().min(1),
    duree_minutes: z.number().int().positive(),
    titre: z.string().min(1),
    competences: z.array(z.enum(COMPETENCES)).min(1),
    civic_theme: z.string().nullable().default(null),
    civic_mention: z.enum(CIVIC_MENTIONS).nullable().default(null),
    objectifs: z.array(z.string().min(1)).min(1),
    source_ids: z.array(z.string()).default([]),
    statut: z.enum(CURRICULUM_RESOURCE_STATUSES).default('planned'),
  })
  .strict()
  .superRefine((entry, ctx) => {
    if (entry.kind === 'session' && entry.module === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${entry.session_code} : une seance (kind=session) doit appartenir a un module (A-G).`,
        path: ['module'],
      });
    }
  });

export const curriculumManifestSchema = z
  .object({
    version: z.string().min(1),
    plan_version: z.string().min(1),
    generated_at: z.string().min(1),
    entries: z.array(manifestEntrySchema),
  })
  .strict()
  .superRefine((manifest, ctx) => {
    const { entries } = manifest;

    if (entries.length !== TOTAL_ENTRY_COUNT) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Le manifeste doit contenir exactement ${TOTAL_ENTRY_COUNT} entrees (37 seances + 4 evaluations), trouve ${entries.length}.`,
        path: ['entries'],
      });
    }

    const seen = new Map();
    for (const entry of entries) {
      if (seen.has(entry.session_code)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Code de seance duplique : ${entry.session_code}.`,
          path: ['entries'],
        });
      }
      seen.set(entry.session_code, (seen.get(entry.session_code) ?? 0) + 1);
    }

    const expectedCodes = [
      ...Array.from({ length: 37 }, (_, i) => `S${String(i + 1).padStart(2, '0')}`),
      'E1',
      'E2',
      'E3',
      'E4',
    ];
    for (const code of expectedCodes) {
      if (!seen.has(code)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Seance manquante dans le manifeste : ${code}.`,
          path: ['entries'],
        });
      }
    }

    const ordres = entries.map((entry) => entry.ordre);
    if (new Set(ordres).size !== ordres.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Les valeurs "ordre" doivent etre uniques dans le manifeste.',
        path: ['entries'],
      });
    }

    if (entries.length > 0) {
      const { valid, errors } = validateCumulativeHours(entries);
      if (!valid) {
        for (const error of errors) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Coherence horaire 80/100/120h invalide : ${error}`,
            path: ['entries'],
          });
        }
      }
    }
  });
