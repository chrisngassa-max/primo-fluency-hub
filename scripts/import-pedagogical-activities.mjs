import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_JSON_PATH = 'D:/formations/tcf/docs/master_activities.json';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const jsonArg = args.find((arg) => arg !== '--dry-run');
const jsonPath = resolve(jsonArg ?? DEFAULT_JSON_PATH);
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!dryRun && (!supabaseUrl || !serviceRoleKey)) {
  console.error('Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  console.error('Example: $env:SUPABASE_URL="https://..."; $env:SUPABASE_SERVICE_ROLE_KEY="..."; npm run import:pedagogical-activities');
  process.exit(1);
}

const raw = await readFile(jsonPath, 'utf8');
const activities = JSON.parse(raw);

if (!Array.isArray(activities)) {
  throw new Error(`Expected an array of activities in ${jsonPath}`);
}

function toArray(value) {
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

function stablePart(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

const rows = activities.map((activity) => ({
  import_key: [
    stablePart(activity.activity_id),
    stablePart(activity.document_id),
    stablePart(activity.source_pdf),
    stablePart(activity.title),
  ].join('::'),
  activity_id: activity.activity_id,
  title: activity.title,
  category: activity.category,
  audience: activity.audience ?? null,
  level_min: activity.level_min,
  level_max: activity.level_max,
  objective: activity.objective ?? '',
  duration_min: activity.duration_min ?? null,
  duration_max: activity.duration_max ?? null,
  materials_needed: toArray(activity.materials_needed),
  instructions: activity.instructions ?? '',
  tags: toArray(activity.tags),
  document_id: activity.document_id ?? null,
  source_pdf: activity.source_pdf ?? null,
  source_kind: 'pdf_extraction',
  raw: activity,
}));

const missingRequired = rows.filter(
  (row) => !row.import_key || !row.activity_id || !row.title || !row.category || !row.level_min || !row.level_max,
);

if (missingRequired.length > 0) {
  throw new Error(`Import aborted: ${missingRequired.length} row(s) are missing required fields.`);
}

const duplicateImportKeys = rows.reduce((counts, row) => {
  counts[row.import_key] = (counts[row.import_key] ?? 0) + 1;
  return counts;
}, {});

const duplicateCount = Object.values(duplicateImportKeys).filter((count) => count > 1).length;

if (duplicateCount > 0) {
  throw new Error(`Import aborted: ${duplicateCount} duplicate import key(s) found.`);
}

if (dryRun) {
  const countsByCategory = rows.reduce((counts, row) => {
    counts[row.category] = (counts[row.category] ?? 0) + 1;
    return counts;
  }, {});

  const duplicateActivityIds = rows.reduce((counts, row) => {
    counts[row.activity_id] = (counts[row.activity_id] ?? 0) + 1;
    return counts;
  }, {});
  const duplicateActivityIdCount = Object.values(duplicateActivityIds).filter((count) => count > 1).length;

  console.log(`Dry run OK: ${rows.length} pedagogical activities parsed from ${jsonPath}`);
  console.log(`Duplicate activity_id values preserved as separate source rows: ${duplicateActivityIdCount}`);
  console.table(countsByCategory);
  process.exit(0);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const batchSize = 100;
let imported = 0;

for (let start = 0; start < rows.length; start += batchSize) {
  const batch = rows.slice(start, start + batchSize);
  const { error } = await supabase
    .from('pedagogical_activities')
    .upsert(batch, { onConflict: 'import_key' });

  if (error) {
    console.error(error);
    process.exit(1);
  }

  imported += batch.length;
}

console.log(`Imported ${imported} pedagogical activities from ${jsonPath}`);
