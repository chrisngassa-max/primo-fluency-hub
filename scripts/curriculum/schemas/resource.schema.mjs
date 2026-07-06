import { z } from 'zod';
import { GENERATION_MODES, RIGHTS_STATUSES } from './constants.mjs';

// Section 8.3 : "Chaque ressource exige : resource_id, kind, required,
// generation_mode, prompt_version, required_elements, forbidden_elements,
// source_ids, rights_status, output_spec, alt_text, depends_on_answer,
// expected_hash et dependencies."
export const resourceSchema = z
  .object({
    resource_id: z.string().min(1),
    kind: z.string().min(1),
    required: z.boolean(),
    generation_mode: z.enum(GENERATION_MODES),
    prompt_version: z.string().min(1).nullable().default(null),
    required_elements: z.array(z.string()).default([]),
    forbidden_elements: z.array(z.string()).default([]),
    source_ids: z.array(z.string()).default([]),
    rights_status: z.enum(RIGHTS_STATUSES),
    output_spec: z.record(z.string(), z.unknown()).default({}),
    alt_text: z.string().nullable().default(null),
    depends_on_answer: z.boolean().default(false),
    expected_hash: z.string().nullable().default(null),
    dependencies: z.array(z.string()).default([]),
  })
  .superRefine((resource, ctx) => {
    if (resource.generation_mode === 'ai_generated' && !resource.prompt_version) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `prompt_version est obligatoire pour la ressource ${resource.resource_id} (generation_mode=ai_generated).`,
        path: ['prompt_version'],
      });
    }

    if (resource.rights_status === 'official_source' && resource.source_ids.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `source_ids est obligatoire pour la ressource ${resource.resource_id} (rights_status=official_source).`,
        path: ['source_ids'],
      });
    }
  });
