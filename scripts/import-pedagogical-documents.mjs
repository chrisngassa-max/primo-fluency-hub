import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_DOCS_ROOT = 'D:/formations/tcf/docs';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const withoutErrors = args.includes('--without-errors');
const positionalArgs = args.filter((arg) => !arg.startsWith('--'));

const docsRoot = resolve(positionalArgs[0] ?? DEFAULT_DOCS_ROOT);

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!dryRun && (!supabaseUrl || !serviceRoleKey)) {
  console.error('Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  console.error('Example: $env:SUPABASE_URL="https://..."; $env:SUPABASE_SERVICE_ROLE_KEY="..."; npm run import:pedagogical-documents');
  process.exit(1);
}

async function findFiles(dir, predicate, results = []) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'convergence') {
      continue;
    }

    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      await findFiles(fullPath, predicate, results);
    } else if (predicate(fullPath)) {
      results.push(fullPath);
    }
  }

  return results;
}

const documentPaths = await findFiles(
  docsRoot,
  (filePath) => filePath.replaceAll('\\', '/').endsWith('/output/metadata/documents.json'),
);

const errorPaths = withoutErrors
  ? []
  : await findFiles(
      docsRoot,
      (filePath) => filePath.replaceAll('\\', '/').endsWith('/output/logs/extraction_errors.json'),
    );

const documents = (
  await Promise.all(documentPaths.map(async (path) => JSON.parse(await readFile(path, 'utf8'))))
).flat();

if (!Array.isArray(documents)) {
  throw new Error(`Expected document arrays under ${docsRoot}`);
}

const documentRows = documents.map((document) => ({
  document_id: document.document_id,
  file_name: document.file_name,
  title: document.title,
  document_type: document.document_type ?? null,
  audience: document.audience ?? null,
  levels: Array.isArray(document.levels) ? document.levels : [],
  short_summary: document.short_summary ?? '',
  activity_count: document.activity_count ?? 0,
  markdown_file: document.markdown_file ?? null,
  source_kind: 'pdf_extraction',
  raw: document,
}));

const missingDocuments = documentRows.filter(
  (row) => !row.document_id || !row.file_name || !row.title,
);

if (missingDocuments.length > 0) {
  throw new Error(`Import aborted: ${missingDocuments.length} document row(s) are missing required fields.`);
}

let errorRows = [];

if (!withoutErrors) {
  const errors = (
    await Promise.all(errorPaths.map(async (path) => JSON.parse(await readFile(path, 'utf8'))))
  ).flat();

  if (!Array.isArray(errors)) {
    throw new Error(`Expected extraction error arrays under ${docsRoot}`);
  }

  errorRows = errors.map((entry) => ({
    file_name: entry.file,
    error: entry.error,
    source_kind: 'pdf_extraction',
    raw: entry,
  }));

  const missingErrors = errorRows.filter((row) => !row.file_name || !row.error);

  if (missingErrors.length > 0) {
    throw new Error(`Import aborted: ${missingErrors.length} extraction error row(s) are missing required fields.`);
  }
}

if (dryRun) {
  console.log(`Dry run OK: ${documentRows.length} pedagogical document(s) parsed from ${documentPaths.length} metadata file(s) under ${docsRoot}`);
  console.table(documentRows.map((row) => ({
    document_id: row.document_id,
    type: row.document_type,
    levels: row.levels.join(', '),
    activities: row.activity_count,
  })));

  if (!withoutErrors) {
    console.log(`Dry run OK: ${errorRows.length} extraction error(s) parsed from ${errorPaths.length} log file(s) under ${docsRoot}`);
  }

  process.exit(0);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const { error: documentsError } = await supabase
  .from('pedagogical_documents')
  .upsert(documentRows, { onConflict: 'document_id' });

if (documentsError) {
  console.error(documentsError);
  process.exit(1);
}

if (!withoutErrors && errorRows.length > 0) {
  const { error: extractionErrorsError } = await supabase
    .from('pedagogical_extraction_errors')
    .upsert(errorRows, { onConflict: 'file_name' });

  if (extractionErrorsError) {
    console.error(extractionErrorsError);
    process.exit(1);
  }
}

console.log(`Imported ${documentRows.length} pedagogical document(s) from ${documentPaths.length} metadata file(s) under ${docsRoot}`);

if (!withoutErrors) {
  console.log(`Imported ${errorRows.length} extraction error(s) from ${errorPaths.length} log file(s) under ${docsRoot}`);
}
