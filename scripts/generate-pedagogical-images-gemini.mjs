import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';

const DEFAULT_PLAN_PATH = 'scripts/pedagogical-image-generation-plan.json';
const DEFAULT_MODEL = 'gemini-2.5-flash-image';
const DEFAULT_IMPORT_FILE = 'pedagogical_images_gemini_import.json';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');

function valueAfter(flag, fallback = null) {
  const index = args.indexOf(flag);
  if (index === -1) return fallback;
  return args[index + 1] ?? fallback;
}

const positionalArgs = args.filter((arg, index) => {
  const previous = args[index - 1];
  return !arg.startsWith('--') && !['--limit', '--start', '--model', '--out'].includes(previous);
});

const planPath = resolve(positionalArgs[0] ?? DEFAULT_PLAN_PATH);
const limit = Number.parseInt(valueAfter('--limit', '0'), 10) || 0;
const start = Math.max(0, Number.parseInt(valueAfter('--start', '0'), 10) || 0);
const model = valueAfter('--model', DEFAULT_MODEL);
const outputOverride = valueAfter('--out');
const apiKey = process.env.GEMINI_API_KEY;

function extensionForMimeType(mimeType) {
  if (mimeType === 'image/jpeg') return '.jpg';
  if (mimeType === 'image/webp') return '.webp';
  return '.png';
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function buildPrompt(item) {
  return [
    item.prompt,
    '',
    'Pedagogical constraints:',
    '- Use realistic documentary photography, suitable for adult FLE / TCF IRN exercises.',
    '- Avoid brands, watermarks, official emblems, real addresses, real phone numbers, real names, and real personal data.',
    '- If text is visible, keep it short, simple, and intentionally fictitious.',
    '- Prefer clear composition, natural light, and a horizontal 16:9 frame unless the scene explicitly requires otherwise.',
  ].join('\n');
}

function extractInlineImage(responseJson) {
  const candidates = responseJson?.candidates ?? [];

  for (const candidate of candidates) {
    const parts = candidate?.content?.parts ?? [];

    for (const part of parts) {
      const inlineData = part.inlineData ?? part.inline_data;
      if (!inlineData?.data) continue;

      const mimeType = inlineData.mimeType ?? inlineData.mime_type ?? 'image/png';
      return {
        data: inlineData.data,
        mimeType,
      };
    }
  }

  return null;
}

async function generateImage(item) {
  const prompt = buildPrompt(item);
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    }),
  });

  const bodyText = await response.text();
  let bodyJson;

  try {
    bodyJson = JSON.parse(bodyText);
  } catch {
    throw new Error(`Gemini returned a non-JSON response for ${item.slug}: ${bodyText.slice(0, 300)}`);
  }

  if (!response.ok) {
    const message = bodyJson?.error?.message ?? bodyText.slice(0, 300);
    throw new Error(`Gemini error for ${item.slug}: ${response.status} ${response.statusText} - ${message}`);
  }

  const inlineImage = extractInlineImage(bodyJson);
  if (!inlineImage) {
    throw new Error(`Gemini response did not include an inline image for ${item.slug}.`);
  }

  return inlineImage;
}

function toImportImage(item, defaults, batch, fileName) {
  const storagePath = `generated/${batch}/${fileName}`;

  return {
    import_key: `gemini:${item.slug}`,
    title: item.title,
    description: item.description,
    alt_text: item.alt_text,
    storage_path: storagePath,
    source: defaults.source,
    license: defaults.license,
    attribution: defaults.attribution,
    author: defaults.source,
    level_tags: item.level_tags,
    skill_tags: item.skill_tags,
    theme_tags: item.theme_tags,
    pedagogical_tags: item.pedagogical_tags,
    language_level: item.language_level,
    recommended_exercise_types: item.recommended_exercise_types,
    quality_score: defaults.quality_score,
    pedagogical_relevance_score: defaults.pedagogical_relevance_score,
    rejected: defaults.rejected,
    generation_model: model,
    generation_prompt: buildPrompt(item),
  };
}

const plan = JSON.parse(await readFile(planPath, 'utf8'));
const batch = plan.batch ?? 'gemini-generated-images';
const outputRoot = resolve(outputOverride ?? plan.output_root);
const defaults = plan.defaults ?? {};
const selectedImages = (Array.isArray(plan.images) ? plan.images : []).slice(start, limit ? start + limit : undefined);

if (selectedImages.length === 0) {
  throw new Error(`No planned image found in ${planPath}.`);
}

console.log(`Plan: ${planPath}`);
console.log(`Output: ${outputRoot}`);
console.log(`Model: ${model}`);
console.log(`Images selected: ${selectedImages.length}${start ? ` (starting at ${start})` : ''}`);

if (dryRun) {
  console.table(
    selectedImages.map((item) => ({
      slug: item.slug,
      level: item.language_level,
      skills: item.skill_tags?.join(','),
      themes: item.theme_tags?.slice(0, 3).join(','),
    })),
  );
  console.log('Dry run only: no Gemini API call was made.');
  process.exit(0);
}

if (!apiKey) {
  console.error('Missing GEMINI_API_KEY in this shell.');
  console.error('Example: $env:GEMINI_API_KEY="..."; npm run generate:pedagogical-images');
  process.exit(1);
}

await mkdir(outputRoot, { recursive: true });

const importImages = [];
let generated = 0;
let skipped = 0;

for (const item of selectedImages) {
  const preferredPath = resolve(outputRoot, `${item.slug}.png`);

  if (!force && (await exists(preferredPath))) {
    skipped += 1;
    importImages.push(toImportImage(item, defaults, batch, `${item.slug}${extname(preferredPath)}`));
    console.log(`Skipped existing image: ${item.slug}`);
    continue;
  }

  console.log(`Generating ${item.slug}...`);
  const inlineImage = await generateImage(item);
  const extension = extensionForMimeType(inlineImage.mimeType);
  const fileName = `${item.slug}${extension}`;
  const outputPath = resolve(outputRoot, fileName);
  const imageBytes = Buffer.from(inlineImage.data, 'base64');

  await writeFile(outputPath, imageBytes);
  importImages.push(toImportImage(item, defaults, batch, fileName));
  generated += 1;

  console.log(`Saved ${outputPath}`);
}

const importPayload = {
  batch,
  generated_at: new Date().toISOString(),
  source_plan: planPath,
  images: importImages,
};

const importPath = resolve(outputRoot, DEFAULT_IMPORT_FILE);
await writeFile(importPath, `${JSON.stringify(importPayload, null, 2)}\n`, 'utf8');

console.log(`Generated ${generated} image(s), skipped ${skipped} existing image(s).`);
console.log(`Import manifest: ${importPath}`);
