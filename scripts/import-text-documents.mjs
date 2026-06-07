import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, extname, relative, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_TEXT_ROOT = 'D:/formations/tcf/docs/niveaux';
const SUMMARY_MAX_CHARS = 900;
const RAW_TEXT_MAX_CHARS = 12000;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const positionalArgs = args.filter((arg) => !arg.startsWith('--'));
const textRoot = resolve(positionalArgs[0] ?? DEFAULT_TEXT_ROOT);

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!dryRun && (!supabaseUrl || !serviceRoleKey)) {
  console.error('Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  console.error('Example: $env:SUPABASE_URL="https://..."; $env:SUPABASE_SERVICE_ROLE_KEY="..."; npm run import:text-documents');
  process.exit(1);
}

async function findTextFiles(dir, results = []) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = resolve(dir, entry.name);

    if (entry.isDirectory()) {
      await findTextFiles(fullPath, results);
    } else if (entry.isFile() && extname(entry.name).toLowerCase() === '.txt') {
      results.push(fullPath);
    }
  }

  return results;
}

function normalizeSpaces(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function withoutNumericPrefix(value) {
  return value.replace(/^\d+[-_\s]*/, '').trim();
}

function titleFromFile(filePath) {
  const rawName = basename(filePath, extname(filePath));
  return normalizeSpaces(
    withoutNumericPrefix(rawName)
      .replace(/[-_]+/g, ' ')
      .replace(/\bpdf\b/gi, '')
      .replace(/\s+/g, ' '),
  );
}

function normalizePathPart(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function inferDocumentType(relativePath) {
  const normalized = normalizePathPart(relativePath);

  if (normalized.includes('comprehension orale')) return 'compréhension orale';
  if (normalized.includes('comprehension ecrite')) return 'compréhension écrite';
  if (normalized.includes('expression orale') || normalized.includes('production orale')) return 'expression orale';
  if (normalized.includes('expression ecrite') || normalized.includes('production ecrite')) return 'expression écrite';
  if (isStructureDocument(normalized)) return 'structures de la langue';
  if (normalized.includes('phonetique')) return 'phonétique';
  if (normalized.includes('theorie')) return 'théorie';

  return 'document texte';
}

function detectTcfExerciseTemplate(relativePath, title, content) {
  const source = normalizePathPart(`${relativePath} ${title} ${content.slice(0, 6000)}`);

  if (!source.includes('tcf')) {
    return null;
  }

  const competences = new Set();
  const normalizedPath = normalizePathPart(relativePath);

  if (normalizedPath.includes('comprehension ecrite')) {
    competences.add('CE');
  }

  if (normalizedPath.includes('comprehension orale')) {
    competences.add('CO');
  }

  if (normalizedPath.includes('expression ecrite') || normalizedPath.includes('production ecrite')) {
    competences.add('EE');
  }

  if (normalizedPath.includes('expression orale') || normalizedPath.includes('production orale')) {
    competences.add('EO');
  }

  if (source.includes('structures de la langue') || source.includes('tcf grammaire')) {
    competences.add('Structures');
  }

  if (source.includes('comprehension ecrite')) {
    competences.add('CE');
  }

  if (source.includes('comprehension orale')) {
    competences.add('CO');
  }

  if (source.includes('expression ecrite') || source.includes('pro ecrite') || source.includes('production ecrite')) {
    competences.add('EE');
  }

  if (source.includes('expression orale') || source.includes('production orale')) {
    competences.add('EO');
  }

  const detected = Array.from(competences);

  if (detected.length === 0) {
    return {
      primaryDocumentType: 'gabarit exercice TCF',
      competences: ['Structures'],
      formats: ['QCM', 'texte lacunaire'],
    };
  }

  return {
    primaryDocumentType: detected.length === 1 ? documentTypeLabel(detected[0]) : 'gabarit exercice TCF',
    competences: detected,
    formats: inferTcfFormats(source, detected),
  };
}

function documentTypeLabel(competence) {
  const labels = {
    CO: 'compr\u00e9hension orale',
    CE: 'compr\u00e9hension \u00e9crite',
    EO: 'expression orale',
    EE: 'expression \u00e9crite',
    Structures: 'structures de la langue',
  };

  return labels[competence] ?? 'structures de la langue';
}

function inferTcfFormats(normalizedSource, competences) {
  const formats = new Set();

  if (
    normalizedSource.includes('qcm') ||
    normalizedSource.includes('choix multiple') ||
    normalizedSource.includes('corrige') ||
    normalizedSource.match(/\b[abcd][\).]/)
  ) {
    formats.add('QCM');
  }

  if (normalizedSource.includes('lacunaire') || normalizedSource.includes('completer')) {
    formats.add('texte lacunaire');
  }

  if (competences.includes('EE')) {
    formats.add('tache de production ecrite');
  }

  if (competences.includes('EO')) {
    formats.add('tache de production orale');
  }

  return Array.from(formats.size ? formats : ['gabarit TCF']);
}

function isStructureDocument(normalizedPath) {
  return (
    normalizedPath.includes('structure') ||
    normalizedPath.includes('conjugaison') ||
    normalizedPath.includes('grammaire') ||
    normalizedPath.includes('vocabulaire') ||
    normalizedPath.includes('lexique') ||
    normalizedPath.includes('syntaxe') ||
    normalizedPath.includes('morphologie')
  );
}

function inferStructureDomain(relativePath) {
  const normalized = normalizePathPart(relativePath);

  if (!isStructureDocument(normalized)) return null;
  if (normalized.includes('conjugaison')) return 'conjugaison';
  if (normalized.includes('grammaire')) return 'grammaire';
  if (normalized.includes('vocabulaire') || normalized.includes('lexique')) return 'vocabulaire en contexte';
  if (normalized.includes('syntaxe')) return 'syntaxe';
  if (normalized.includes('morphologie')) return 'morphologie';

  return 'structures';
}

function inferLevels(relativePath, title) {
  const source = `${relativePath} ${title}`.toUpperCase();
  const levels = new Set();
  const matches = source.match(/\b(?:PRE-A1|PRÉ-A1|A0|A1|A2|B1|B2|C1|C2)\b/g) ?? [];

  for (const match of matches) {
    levels.add(match.replace('PRÉ-A1', 'Pré-A1').replace('PRE-A1', 'Pré-A1'));
  }

  return Array.from(levels);
}

function stableDocumentId(relativePath) {
  const normalized = relativePath.replaceAll('\\', '/').toLowerCase();
  const hash = createHash('sha1').update(normalized).digest('hex').slice(0, 12);
  const slug = normalized
    .replace(/\.txt$/i, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);

  return `text-doc:${slug}:${hash}`;
}

function buildSummary(text) {
  const compact = normalizeSpaces(text);
  if (compact.length <= SUMMARY_MAX_CHARS) return compact;
  return `${compact.slice(0, SUMMARY_MAX_CHARS).trim()}...`;
}

function buildSearchableSummary(text, documentType, structureDomain) {
  const summary = buildSummary(text);

  if (documentType !== 'structures de la langue') return summary;

  return normalizeSpaces(
    [
      'Structures TCF IRN: grammaire, conjugaison, syntaxe, vocabulaire en contexte, morphologie, QCM, texte lacunaire.',
      structureDomain ? `Sous-domaine: ${structureDomain}.` : '',
      summary,
    ].join(' '),
  );
}

const textPaths = await findTextFiles(textRoot);

const rows = await Promise.all(
  textPaths.map(async (filePath) => {
    const relativePath = relative(textRoot, filePath).replaceAll('\\', '/');
    const content = await readFile(filePath, 'utf8');
    const fileStat = await stat(filePath);
    const title = titleFromFile(filePath);
    const levels = inferLevels(relativePath, title);
    const tcfTemplate = detectTcfExerciseTemplate(relativePath, title, content);
    const documentType = tcfTemplate?.primaryDocumentType ?? inferDocumentType(relativePath);
    const structureDomain = inferStructureDomain(relativePath);

    return {
      document_id: stableDocumentId(relativePath),
      file_name: relativePath,
      title,
      document_type: documentType,
      audience: 'apprenants FLE / TCF',
      levels,
      short_summary: buildSearchableSummary(content, documentType, structureDomain),
      activity_count: 0,
      markdown_file: null,
      source_kind: tcfTemplate ? 'tcf_exercise_template_import' : 'text_file_import',
      raw: {
        tcf_irn_competence:
          tcfTemplate?.competences?.[0] ?? (documentType === 'structures de la langue' ? 'Structures' : null),
        tcf_irn_competences: tcfTemplate?.competences ?? [],
        is_tcf_exercise_template: Boolean(tcfTemplate),
        structure_domain: structureDomain,
        format_recommandes:
          tcfTemplate?.formats ?? (documentType === 'structures de la langue' ? ['QCM', 'texte lacunaire'] : []),
        source_path: filePath.replaceAll('\\', '/'),
        relative_path: relativePath,
        file_size_bytes: fileStat.size,
        imported_as: 'pedagogical_documents',
        text_excerpt: content.slice(0, RAW_TEXT_MAX_CHARS),
        text_truncated: content.length > RAW_TEXT_MAX_CHARS,
      },
    };
  }),
);

const missingRequired = rows.filter((row) => !row.document_id || !row.file_name || !row.title);

if (missingRequired.length > 0) {
  throw new Error(`Import aborted: ${missingRequired.length} text document row(s) are missing required fields.`);
}

const duplicateIds = rows.reduce((counts, row) => {
  counts[row.document_id] = (counts[row.document_id] ?? 0) + 1;
  return counts;
}, {});
const duplicateCount = Object.values(duplicateIds).filter((count) => count > 1).length;

if (duplicateCount > 0) {
  throw new Error(`Import aborted: ${duplicateCount} duplicate document_id value(s) found.`);
}

if (dryRun) {
  const countsByType = rows.reduce((counts, row) => {
    counts[row.document_type] = (counts[row.document_type] ?? 0) + 1;
    return counts;
  }, {});

  console.log(`Dry run OK: ${rows.length} text document(s) parsed under ${textRoot}`);
  console.table(countsByType);
  console.table(
    rows.slice(0, 12).map((row) => ({
      document_id: row.document_id,
      type: row.document_type,
      levels: row.levels.join(', '),
      file_name: row.file_name,
    })),
  );
  process.exit(0);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const batchSize = 50;
let imported = 0;

for (let start = 0; start < rows.length; start += batchSize) {
  const batch = rows.slice(start, start + batchSize);
  const { error } = await supabase
    .from('pedagogical_documents')
    .upsert(batch, { onConflict: 'document_id' });

  if (error) {
    console.error(error);
    process.exit(1);
  }

  imported += batch.length;
}

console.log(`Imported ${imported} text document(s) into pedagogical_documents from ${textRoot}`);
