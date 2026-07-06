import { z } from 'zod';
import { CURRICULUM_RESOURCE_STATUSES } from './constants.mjs';

// Section 8.1 (invariant_supports) : "support_id, version, hash, donnees
// canoniques, source_ids, statut". Les donnees canoniques (personnages,
// situation, faits, nombres, dates) sont ce qui doit rester identique
// entre les quatre traitements A1/A2/B1/B2 (section 5).
export const supportSchema = z
  .object({
    support_id: z.string().min(1),
    version: z.number().int().positive().default(1),
    hash: z.string().min(1),
    session_code: z.string().regex(/^(S[0-3][0-9]|E[1-4])$/),
    personnages: z.array(z.string()).default([]),
    situation: z.string().min(1),
    faits: z.array(z.string()).default([]),
    nombres: z.array(z.union([z.string(), z.number()])).default([]),
    dates: z.array(z.string()).default([]),
    source_ids: z.array(z.string()).default([]),
    statut: z.enum(CURRICULUM_RESOURCE_STATUSES).default('planned'),
  })
  .strict();
