import {
  LOUISE_FACTS_HASH,
  PILOT_EXERCISE_IDS,
  type HintBankEntry,
  type HintValidationIssue,
  type SealedItemForHints,
} from './types.ts';

const MAX_HINT_LEN = 220;
const STOP = new Set([
  'avec', 'dans', 'pour', 'plus', 'moins', 'tout', 'tous', 'toute', 'toutes', 'cette', 'celui',
  'celle', 'elles', 'leurs', 'notre', 'votre', 'alors', 'aussi', 'donc', 'mais', 'comme',
  'quand', 'apres', 'avant', 'entre', 'sans', 'sous', 'vers', 'chez', 'etre', 'avoir', 'fait',
  'faire', 'peut', 'sont', 'vous', 'nous', 'elle', 'ils', 'les', 'des', 'une', 'aux', 'par',
  'sur', 'pas', 'qui', 'que', 'quoi', 'dont', 'est', 'ces', 'ses', 'son', 'sa', 'du', 'de',
  'la', 'le', 'un', 'et', 'ou', 'en', 'au', 'ce', 'il', 'ne', 'se', 'y', 'a', 'd', 'l',
]);

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function tokens(text: string): string[] {
  return normalize(text)
    .replace(/[^a-z0-9'\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 4 && !STOP.has(t));
}

const PILOT = new Set<string>(PILOT_EXERCISE_IDS);

const EXPLICIT_ANSWER = [
  /la\s+bonne\s+reponse/,
  /la\s+bonne\s+est/,
  /reponse\s+correcte/,
  /coche[rz]?\s+(la\s+)?(bonne|option)/,
  /choisis\s+(la\s+)?(bonne|option)/,
  /la\s+reponse\s+est/,
];

export function validateHintEntry(
  entry: HintBankEntry,
  sealed: SealedItemForHints,
): HintValidationIssue[] {
  const issues: HintValidationIssue[] = [];
  if (!['draft', 'validated', 'rejected', 'needs_review'].includes(entry.review_status)) {
    issues.push('status_unknown');
  }
  if (entry.facts_hash !== sealed.facts_hash || entry.facts_hash !== LOUISE_FACTS_HASH) {
    issues.push('facts_hash_mismatch');
  }
  if (
    !PILOT.has(entry.exercise_id) ||
    entry.exercise_id !== sealed.exercise_id ||
    entry.item_id !== sealed.item_id ||
    entry.level !== sealed.level
  ) {
    issues.push('exercise_or_item_out_of_pilot');
  }
  if (!Array.isArray(entry.hints) || entry.hints.length !== 3) {
    issues.push('hint_count');
  }
  const ordinals = (entry.hints ?? []).map((h) => h.ordinal);
  if (new Set(ordinals).size !== 3 || ![1, 2, 3].every((n) => ordinals.includes(n as 1 | 2 | 3))) {
    issues.push('ordinal_missing_or_duplicate');
  }

  const correct = sealed.choices.filter((c) => c.is_correct);
  const wrong = sealed.choices.filter((c) => !c.is_correct);
  const wrongBlob = normalize(wrong.map((c) => c.text).join(' '));
  const discriminant = new Set(
    correct.flatMap((c) => tokens(c.text)).filter((t) => !wrongBlob.includes(t)),
  );
  const justificationNorm = normalize(sealed.justification ?? '');
  const sealedFactRefs = new Set(sealed.fact_refs);
  if (!entry.fact_refs?.length || !entry.fact_refs.every((ref) => sealedFactRefs.has(ref))) {
    issues.push('fact_refs_unanchored');
  }

  for (const hint of entry.hints ?? []) {
    const text = (hint.text ?? '').trim();
    if (!text || text.length > MAX_HINT_LEN) issues.push('hint_empty_or_too_long');
    const n = normalize(text);
    if (
      /\boption\s*[abcd]\b/.test(n) ||
      /\breponse\s*[abcd1-4]\b/.test(n) ||
      /(?:^|[\s(,;:])[abcd](?:\)|\.|:)\s/.test(n) ||
      /\bn[°o]\s*\d/.test(n)
    ) {
      issues.push('option_letter_or_number');
    }
    if (EXPLICIT_ANSWER.some((re) => re.test(n))) issues.push('explicit_answer_phrase');
    if (justificationNorm && n && (n === justificationNorm || (justificationNorm.length > 40 && justificationNorm.includes(n)))) {
      issues.push('justification_copy');
    }
    if (/elimine|ecarte|pas\s+(la\s+)?(option\s+)?[abcd]|option\s+[abcd]\s+est\s+fausse/.test(n)) {
      issues.push('eliminated_option_reference');
    }
    for (const word of tokens(text)) {
      if (discriminant.has(word)) {
        issues.push('discriminant_correct_option');
        break;
      }
    }
  }

  return [...new Set(issues)];
}

export function assertBankIntegrity(
  bank: readonly HintBankEntry[],
  sealedByKey: Map<string, SealedItemForHints>,
): Map<string, HintValidationIssue[]> {
  const out = new Map<string, HintValidationIssue[]>();
  for (const entry of bank) {
    const key = `${entry.exercise_id}::${entry.item_id}`;
    const sealed = sealedByKey.get(key);
    if (!sealed) {
      out.set(key, ['exercise_or_item_out_of_pilot']);
      continue;
    }
    const issues = validateHintEntry(entry, sealed);
    if (issues.length) out.set(key, issues);
  }
  return out;
}
