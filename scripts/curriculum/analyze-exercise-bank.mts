// Rapport de PREPARATION de la banque d'exercices — LECTURE SEULE.
//
// N'ecrit RIEN en base. Prend un dump JSON local (deja recupere en lecture
// seule via `supabase db query --linked`, jamais commit dans le repo) et
// calcule, pour chaque exercice, sa duree via le VRAI moteur
// `computeExerciseDuration` (importe directement, pas reimplemente), sa
// validite de contenu, la presence d'un corrigé, sa compatibilite frontend
// et un statut recommande — sans jamais modifier la base.
//
// Usage : npx tsx scripts/curriculum/analyze-exercise-bank.mts <dump.json> <rapport-sortie.md>
// Le dump doit etre `{"rows":[{"dump":[ ...627 lignes... ]}]}` (sortie brute
// de `supabase db query --linked -f dump_banque.sql`).

import { readFileSync, writeFileSync } from 'node:fs';
import { computeExerciseDuration } from '../../supabase/functions/_shared/exercise-duration.ts';

const CHOICE_FORMATS = new Set(['qcm', 'vrai_faux', 'appariement', 'texte_lacunaire', 'transformation']);
const PRODUCTION_FORMATS = new Set(['production_ecrite', 'production_orale']);
const VALID_FORMATS = new Set([...CHOICE_FORMATS, ...PRODUCTION_FORMATS]);

interface ExerciceRow {
  id: string;
  competence: string | null;
  niveau_vise: string | null;
  format: string | null;
  contenu: { items?: unknown[]; script_audio?: string; texte?: string; metadata?: { family_id?: string; time_limit_seconds?: number }; time_limit_seconds?: number } | null;
  duree_limite_secondes: number | null;
  source: string | null;
  theme: string | null;
  validation_score: number | null;
  validation_status: string | null;
  is_ai_generated: boolean | null;
  statut: string | null;
  sous_competence: string | null;
  difficulte: number | null;
}

interface Analysis {
  id: string;
  competence: string | null;
  niveau_vise: string | null;
  format: string | null;
  hasUsableContent: boolean;
  hasCorrige: boolean;
  frontendCompatible: boolean;
  computedDurationSeconds: number | null;
  hasStoredDuration: boolean;
  hasFamilyId: boolean;
  hasSource: boolean;
  reuseScore: number | null; // = validation_score, seul score statique disponible (voir limite documentee dans le rapport)
  statutRecommande: string;
  category: 'reutilisable_immediatement' | 'reparable_automatiquement' | 'necessite_revue_humaine';
  reasons: string[];
}

function hasUsableContent(row: ExerciceRow): boolean {
  if (!row.format) return false;
  if (PRODUCTION_FORMATS.has(row.format)) return true; // consigne suffit, corrige = criteres IA
  const items = Array.isArray(row.contenu?.items) ? row.contenu!.items! : [];
  return items.length > 0;
}

function hasCorrige(row: ExerciceRow): boolean {
  if (!row.format) return false;
  if (PRODUCTION_FORMATS.has(row.format)) return true; // pas de "bonne_reponse" attendue pour ces formats
  const items = Array.isArray(row.contenu?.items) ? (row.contenu!.items! as Array<Record<string, unknown>>) : [];
  if (items.length === 0) return false;
  return items.every((it) => typeof it.bonne_reponse === 'string' && it.bonne_reponse.trim() !== '');
}

function hasStoredDuration(row: ExerciceRow): boolean {
  return Boolean(
    (row.duree_limite_secondes && row.duree_limite_secondes > 0) ||
    (row.contenu?.metadata?.time_limit_seconds && row.contenu.metadata.time_limit_seconds > 0) ||
    (row.contenu?.time_limit_seconds && row.contenu.time_limit_seconds > 0),
  );
}

function analyzeRow(row: ExerciceRow): Analysis {
  const reasons: string[] = [];
  const usable = hasUsableContent(row);
  const corrige = hasCorrige(row);
  const formatValid = row.format != null && VALID_FORMATS.has(row.format);
  const competencePresent = Boolean(row.competence && row.competence.trim() !== '');
  const frontendCompatible = formatValid && usable;
  const storedDuration = hasStoredDuration(row);

  let computedDuration: number | null = null;
  try {
    computedDuration = computeExerciseDuration({
      competence: row.competence ?? undefined,
      format: row.format ?? undefined,
      metadata: undefined,
      contenu: row.contenu ?? undefined,
      nombre_ecoutes_max: undefined,
    });
  } catch {
    computedDuration = null;
  }

  const familyId = Boolean(row.contenu?.metadata?.family_id);
  const source = Boolean(row.source && row.source.trim() !== '');

  let category: Analysis['category'];
  let statutRecommande: string;

  if (!competencePresent) {
    reasons.push('competence absente');
    category = 'necessite_revue_humaine';
    statutRecommande = 'to_review';
  } else if (!usable) {
    reasons.push('contenu non exploitable (items vides pour un format a choix)');
    category = 'necessite_revue_humaine';
    statutRecommande = 'to_review';
  } else if (!corrige) {
    reasons.push('corrige manquant ou incomplet sur au moins un item');
    category = 'necessite_revue_humaine';
    statutRecommande = 'to_review';
  } else if (!storedDuration) {
    reasons.push('duree absente — calculable automatiquement (computeExerciseDuration), aucune ecriture faite');
    category = 'reparable_automatiquement';
    statutRecommande = 'validated_apres_backfill_duree';
  } else {
    category = 'reutilisable_immediatement';
    statutRecommande = 'validated';
  }

  if (!source) reasons.push('provenance (source) non renseignee — informatif, ne bloque pas la categorie');
  if (!familyId) reasons.push('pas de family_id — informatif, non exige hors pipeline de differenciation');

  return {
    id: row.id,
    competence: row.competence,
    niveau_vise: row.niveau_vise,
    format: row.format,
    hasUsableContent: usable,
    hasCorrige: corrige,
    frontendCompatible,
    computedDurationSeconds: computedDuration,
    hasStoredDuration: storedDuration,
    hasFamilyId: familyId,
    hasSource: source,
    reuseScore: row.validation_score,
    statutRecommande,
    category,
    reasons,
  };
}

function main() {
  const [, , dumpPath, outPath] = process.argv;
  if (!dumpPath || !outPath) {
    console.error('Usage: npx tsx analyze-exercise-bank.mts <dump.json> <rapport.md>');
    process.exit(1);
  }

  const raw = readFileSync(dumpPath, 'utf8');
  // La sortie CLI `supabase db query` contient une bannière avant le JSON ;
  // on isole le premier objet JSON valide du fichier.
  const jsonStart = raw.indexOf('{');
  const parsed = JSON.parse(raw.slice(jsonStart));
  const rows: ExerciceRow[] = parsed.rows[0].dump;

  const analyses = rows.map(analyzeRow);

  const byCategory = {
    reutilisable_immediatement: analyses.filter((a) => a.category === 'reutilisable_immediatement'),
    reparable_automatiquement: analyses.filter((a) => a.category === 'reparable_automatiquement'),
    necessite_revue_humaine: analyses.filter((a) => a.category === 'necessite_revue_humaine'),
  };

  function byCompNiveau(list: Analysis[]) {
    const map = new Map<string, number>();
    for (const a of list) {
      const key = `${a.competence ?? '(vide)'} / ${a.niveau_vise ?? '(vide)'}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }

  function reasonCounts(list: Analysis[]) {
    const map = new Map<string, number>();
    for (const a of list) {
      for (const r of a.reasons) {
        if (r.includes('informatif')) continue;
        map.set(r, (map.get(r) ?? 0) + 1);
      }
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }

  const total = analyses.length;
  const lines: string[] = [];
  lines.push('## 12. Rapport de préparation (dry-run, aucune écriture)');
  lines.push('');
  lines.push(
    `> Calculé localement le ${new Date().toISOString().slice(0, 10)} sur un dump en lecture seule des ${total} ` +
    'exercices de la banque partagée, via le vrai moteur `computeExerciseDuration` ' +
    '(`supabase/functions/_shared/exercise-duration.ts`, importé tel quel — pas réimplémenté). ' +
    '**Aucune ligne n\'a été modifiée en base.** Script : `scripts/curriculum/analyze-exercise-bank.mts`.',
  );
  lines.push('');
  lines.push('| Catégorie | Nombre | % |');
  lines.push('|---|---|---|');
  for (const [cat, list] of Object.entries(byCategory)) {
    lines.push(`| ${cat} | ${list.length} | ${((list.length / total) * 100).toFixed(1)}% |`);
  }
  lines.push('');

  lines.push('### Réutilisable immédiatement');
  lines.push('');
  lines.push(
    `${byCategory.reutilisable_immediatement.length} exercices ont un contenu exploitable, un corrigé complet ` +
    'ET une durée déjà présente en base — aucune action nécessaire avant réutilisation.',
  );
  lines.push('');
  lines.push('| Compétence / Niveau | Nombre |');
  lines.push('|---|---|');
  for (const [key, count] of byCompNiveau(byCategory.reutilisable_immediatement)) lines.push(`| ${key} | ${count} |`);
  lines.push('');

  lines.push('### Réparable automatiquement (sans jugement humain)');
  lines.push('');
  lines.push(
    `${byCategory.reparable_automatiquement.length} exercices ont un contenu et un corrigé valides, mais ` +
    'aucune durée stockée. `computeExerciseDuration` peut la calculer de façon déterministe à partir du ' +
    'contenu réel (nombre d\'items, longueur du texte/script audio, compétence) — un backfill est possible ' +
    'sans relecture humaine, mais **n\'a pas été effectué** (aucune autorisation donnée).',
  );
  lines.push('');
  lines.push('| Compétence / Niveau | Nombre |');
  lines.push('|---|---|');
  for (const [key, count] of byCompNiveau(byCategory.reparable_automatiquement)) lines.push(`| ${key} | ${count} |`);
  lines.push('');
  const sampleDurations = byCategory.reparable_automatiquement.slice(0, 5);
  lines.push('Exemples de durées qui seraient calculées (échantillon, aucune écriture) :');
  lines.push('');
  lines.push('| id (tronqué) | compétence | format | durée calculée |');
  lines.push('|---|---|---|---|');
  for (const a of sampleDurations) {
    lines.push(`| ${a.id.slice(0, 8)}… | ${a.competence} | ${a.format} | ${a.computedDurationSeconds}s |`);
  }
  lines.push('');

  lines.push('### Nécessite une revue humaine');
  lines.push('');
  lines.push(
    `${byCategory.necessite_revue_humaine.length} exercices ont un problème de fond (contenu, corrigé ou ` +
    'compétence) qu\'aucun script ne peut corriger sans jugement pédagogique.',
  );
  lines.push('');
  lines.push('| Motif | Nombre |');
  lines.push('|---|---|');
  for (const [reason, count] of reasonCounts(byCategory.necessite_revue_humaine)) lines.push(`| ${reason} | ${count} |`);
  lines.push('');
  lines.push('| Compétence / Niveau | Nombre |');
  lines.push('|---|---|');
  for (const [key, count] of byCompNiveau(byCategory.necessite_revue_humaine)) lines.push(`| ${key} | ${count} |`);
  lines.push('');

  lines.push('### Limite méthodologique assumée');
  lines.push('');
  lines.push(
    '« Score de réutilisation » ci-dessus = `validation_score` stocké (existe sur 6 lignes seulement, voir §4). ' +
    'Le score search-first réel (`scoreExerciseCandidate`) dépend du thème/niveau/compétence de la ' +
    'requête appelante et ne peut pas être précalculé hors contexte — voir §4 pour le détail de cette distinction.',
  );
  lines.push('');

  const reportSection = lines.join('\n');
  writeFileSync(outPath, reportSection, 'utf8');
  console.log(`Rapport ecrit : ${outPath}`);
  console.log(`Total analyse : ${total}`);
  for (const [cat, list] of Object.entries(byCategory)) {
    console.log(`  ${cat}: ${list.length}`);
  }
}

main();
