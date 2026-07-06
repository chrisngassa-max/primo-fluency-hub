import { z } from 'zod';
import { CIVIC_MENTIONS, COMPETENCES } from './constants.mjs';
import { resourceSchema } from './resource.schema.mjs';

// Section 8.3 : "Manifeste de seance minimal" — le fichier SXX/manifest.json
// produit/valide par le pipeline (lots 3-4), distinct du registre racine
// content/curriculum/v2/manifest.json (lot 1).
export const sessionManifestSchema = z
  .object({
    session_code: z.string().regex(/^(S[0-3][0-9]|E[1-4])$/),
    plan_version: z.string().min(1),
    support_id: z.string().min(1),
    type_seance: z.string().min(1),
    objectifs: z.array(z.string().min(1)).min(1),
    competences: z.array(z.enum(COMPETENCES)).min(1),
    civic_theme: z.string().nullable().default(null),
    civic_mention: z.enum(CIVIC_MENTIONS).nullable().default(null),
    source_ids: z.array(z.string()).default([]),
    resources: z.array(resourceSchema).min(1),
    variants: z
      .array(
        z.object({
          niveau: z.enum(['A1', 'A2', 'B1', 'B2']),
          resource_id: z.string().min(1),
        }),
      )
      .default([]),
    duration_plan: z.record(z.string(), z.unknown()).default({}),
    validation_policy: z.record(z.string(), z.unknown()).default({}),
    publication_policy: z.record(z.string(), z.unknown()).default({}),
  })
  .strict()
  .superRefine((manifest, ctx) => {
    const resourceIds = new Set(manifest.resources.map((resource) => resource.resource_id));
    if (resourceIds.size !== manifest.resources.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${manifest.session_code} : resource_id duplique dans le manifeste de seance.`,
        path: ['resources'],
      });
    }

    for (const resource of manifest.resources) {
      for (const dependencyId of resource.dependencies) {
        if (!resourceIds.has(dependencyId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${manifest.session_code} : la ressource ${resource.resource_id} depend de ${dependencyId}, absente du manifeste.`,
            path: ['resources'],
          });
        }
      }
    }
  });
