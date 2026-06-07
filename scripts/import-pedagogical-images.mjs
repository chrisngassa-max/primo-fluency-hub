import { readFile, readdir } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_JSON_PATH = 'D:/formations/tcf/docs/images/pedagogical_images_import.json';
const DEFAULT_IMAGES_ROOT = 'D:/formations/tcf/docs/images';
const BUCKET = 'pedagogical-images';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const skipUpload = args.includes('--skip-upload');
const positionalArgs = args.filter((arg) => !arg.startsWith('--'));

const jsonPath = resolve(positionalArgs[0] ?? DEFAULT_JSON_PATH);
const imagesRoot = resolve(positionalArgs[1] ?? DEFAULT_IMAGES_ROOT);

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!dryRun && (!supabaseUrl || !serviceRoleKey)) {
  console.error('Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  console.error('Example: $env:SUPABASE_URL="https://..."; $env:SUPABASE_SERVICE_ROLE_KEY="..."; npm run import:pedagogical-images');
  process.exit(1);
}

async function findImageFiles(dir, results = []) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = resolve(dir, entry.name);

    if (entry.isDirectory()) {
      await findImageFiles(fullPath, results);
      continue;
    }

    const ext = extname(entry.name).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
      results.push(fullPath);
    }
  }

  return results;
}

function asArray(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(/[,;|]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function normalizeStoragePath(value) {
  return String(value ?? '')
    .replaceAll('\\', '/')
    .replace(/^\/+/, '')
    .replace(/^pedagogical-images\//, '');
}

function contentTypeForPath(filePath) {
  const ext = extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

function stableImportKey(image, objectPath) {
  return String(image.import_key ?? image.storage_path ?? objectPath ?? image.title ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function fileStem(filePath) {
  return String(filePath.split(/[\\/]/).pop() ?? '')
    .replace(/\.[^.]+$/, '')
    .toLowerCase();
}

function findLocalImage(objectPath, localByName, localFiles) {
  const fileName = objectPath.split('/').pop();
  if (!fileName) return null;

  const exact = localByName.get(fileName);
  if (exact) return exact;

  const targetStem = fileStem(fileName);
  const targetParts = targetStem.split('-').filter((part) => part.length > 2);

  const scored = localFiles
    .map((filePath) => {
      const stem = fileStem(filePath);
      const score = targetParts.reduce((count, part) => count + (stem.includes(part) ? 1 : 0), 0);
      return { filePath, score };
    })
    .filter((item) => item.score >= Math.max(2, Math.ceil(targetParts.length * 0.5)))
    .sort((a, b) => b.score - a.score);

  return scored[0]?.filePath ?? null;
}

function mapRow(image, objectPath, publicUrl) {
  return {
    import_key: stableImportKey(image, objectPath),
    title: image.title,
    description: image.description ?? '',
    alt_text: image.alt_text ?? '',
    image_url: image.image_url ?? null,
    source_url: image.source_url ?? null,
    source: image.source ?? null,
    license: image.license ?? null,
    attribution: image.attribution ?? null,
    author: image.author ?? null,
    storage_bucket: BUCKET,
    storage_path: objectPath,
    public_url: publicUrl ?? null,
    level_tags: asArray(image.level_tags),
    skill_tags: asArray(image.skill_tags),
    theme_tags: asArray(image.theme_tags),
    pedagogical_tags: asArray(image.pedagogical_tags),
    language_level: image.language_level ?? null,
    recommended_exercise_types: asArray(image.recommended_exercise_types),
    quality_score: image.quality_score ?? null,
    pedagogical_relevance_score: image.pedagogical_relevance_score ?? null,
    rejected: Boolean(image.rejected),
    rejection_reason: image.rejection_reason ?? '',
    is_active: !image.rejected,
    raw: image,
  };
}

function missingRequired(rows) {
  return rows.filter(
    (row) => !row.import_key || !row.title || !row.storage_path || row.level_tags.length === 0 || row.skill_tags.length === 0,
  );
}

const payload = JSON.parse(await readFile(jsonPath, 'utf8'));
const images = Array.isArray(payload.images) ? payload.images : [];

if (images.length === 0) {
  throw new Error(`No images found in ${jsonPath}`);
}

const localFiles = await findImageFiles(imagesRoot);
const localByName = new Map(localFiles.map((filePath) => [filePath.split(/[\\/]/).pop(), filePath]));

const planned = images.map((image) => {
  const objectPath = normalizeStoragePath(image.storage_path);
  const localPath = findLocalImage(objectPath, localByName, localFiles);
  const publicUrl = supabaseUrl ? `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${objectPath}` : null;

  return {
    image,
    objectPath,
    localPath,
    publicUrl,
    row: mapRow(image, objectPath, publicUrl),
  };
});

const missing = missingRequired(planned.map((item) => item.row));
if (missing.length > 0) {
  throw new Error(`Import aborted: ${missing.length} image row(s) are missing required fields.`);
}

const duplicateKeys = planned.reduce((counts, item) => {
  counts[item.row.import_key] = (counts[item.row.import_key] ?? 0) + 1;
  return counts;
}, {});
const duplicateCount = Object.values(duplicateKeys).filter((count) => count > 1).length;

if (duplicateCount > 0) {
  throw new Error(`Import aborted: ${duplicateCount} duplicate import key(s) found.`);
}

if (dryRun) {
  const missingLocal = planned.filter((item) => !item.localPath);
  const countsByTheme = planned.reduce((counts, item) => {
    const primary = item.row.theme_tags[0] ?? 'sans-theme';
    counts[primary] = (counts[primary] ?? 0) + 1;
    return counts;
  }, {});

  console.log(`Dry run OK: ${planned.length} pedagogical image(s) parsed from ${jsonPath}`);
  console.log(`Local images matched under ${imagesRoot}: ${planned.length - missingLocal.length}/${planned.length}`);
  console.table(countsByTheme);

  if (missingLocal.length > 0) {
    console.log('Images without local file match; import will try image_url download unless --skip-upload is used:');
    console.table(
      missingLocal.map((item) => ({
        title: item.row.title,
        storage_path: item.row.storage_path,
        image_url: item.row.image_url,
      })),
    );
  }

  process.exit(0);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

if (!skipUpload) {
  for (const item of planned) {
    let body;
    let contentType = contentTypeForPath(item.objectPath);

    if (item.localPath) {
      body = await readFile(item.localPath);
      contentType = contentTypeForPath(item.localPath);
    } else if (item.image.image_url) {
      const response = await fetch(item.image.image_url);
      if (!response.ok) {
        throw new Error(`Could not download ${item.image.image_url}: ${response.status} ${response.statusText}`);
      }
      body = new Uint8Array(await response.arrayBuffer());
      contentType = response.headers.get('content-type') ?? contentType;
    } else {
      throw new Error(`No local file or image_url for ${item.row.title}`);
    }

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(item.objectPath, body, {
        contentType,
        upsert: true,
      });

    if (error) {
      console.error(error);
      process.exit(1);
    }
  }
}

const rows = planned.map((item) => item.row);
const batchSize = 50;
let imported = 0;

for (let start = 0; start < rows.length; start += batchSize) {
  const batch = rows.slice(start, start + batchSize);
  const { error } = await supabase
    .from('pedagogical_images')
    .upsert(batch, { onConflict: 'import_key' });

  if (error) {
    console.error(error);
    process.exit(1);
  }

  imported += batch.length;
}

console.log(`Imported ${imported} pedagogical image(s) from ${jsonPath}`);
if (!skipUpload) {
  const localCount = planned.filter((item) => item.localPath).length;
  console.log(`Uploaded ${planned.length} storage object(s) to ${BUCKET} (${localCount} from local files).`);
}
