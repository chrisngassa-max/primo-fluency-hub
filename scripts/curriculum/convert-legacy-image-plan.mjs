// Convertit un plan de generation d'images heritage (scripts/pedagogical-image-generation-plan*.json)
// vers des descripteurs de ressource compatibles avec le manifeste curriculum v2
// (resourceSchema, section 8.3). N'efface ni ne modifie le plan d'origine
// (lot 2 : "Ne pas perdre les plans JSON existants").
//
// Usage :
//   node scripts/curriculum/convert-legacy-image-plan.mjs --plan scripts/pedagogical-image-generation-plan.json --out content/curriculum/v2/_legacy-converted/plan.json

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resourceSchema } from './schemas/resource.schema.mjs';

function valueAfter(args, flag, fallback) {
  const index = args.indexOf(flag);
  if (index === -1) return fallback;
  return args[index + 1] ?? fallback;
}

export function convertLegacyImageItem(item) {
  return resourceSchema.parse({
    resource_id: `legacy-${item.slug}`,
    kind: 'visual_legacy_raster',
    required: false,
    generation_mode: 'raster_provider',
    prompt_version: 'legacy-v1',
    required_elements: [],
    forbidden_elements: ['logo', 'watermark', 'real_personal_data'],
    source_ids: [],
    rights_status: 'cap_tcf_created',
    output_spec: {
      prompt: item.prompt,
      level_tags: item.level_tags ?? [],
      skill_tags: item.skill_tags ?? [],
      theme_tags: item.theme_tags ?? [],
      pedagogical_tags: item.pedagogical_tags ?? [],
      language_level: item.language_level ?? null,
      recommended_exercise_types: item.recommended_exercise_types ?? [],
      legacy_slug: item.slug,
      legacy_title: item.title,
      legacy_description: item.description,
    },
    alt_text: item.alt_text ?? null,
    depends_on_answer: false,
    expected_hash: null,
    dependencies: [],
  });
}

export function convertLegacyPlan(plan) {
  const images = Array.isArray(plan.images) ? plan.images : [];
  return {
    converted_from_batch: plan.batch ?? null,
    converted_at: new Date().toISOString(),
    resources: images.map(convertLegacyImageItem),
  };
}

async function main() {
  const args = process.argv.slice(2);
  const planPath = resolve(valueAfter(args, '--plan', 'scripts/pedagogical-image-generation-plan.json'));
  const outPath = resolve(
    valueAfter(args, '--out', 'content/curriculum/v2/_legacy-converted/pedagogical-image-generation-plan.converted.json'),
  );

  const plan = JSON.parse(await readFile(planPath, 'utf8'));
  const converted = convertLegacyPlan(plan);

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(converted, null, 2)}\n`, 'utf8');

  console.log(`Plan source : ${planPath}`);
  console.log(`${converted.resources.length} ressource(s) convertie(s) -> ${outPath}`);
}

const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMainModule) {
  main().catch((error) => {
    console.error('Erreur pendant la conversion du plan heritage :', error);
    process.exitCode = 1;
  });
}
