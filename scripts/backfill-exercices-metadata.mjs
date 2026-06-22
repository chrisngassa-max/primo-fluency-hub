/**
 * backfill-exercices-metadata.mjs
 * ---------------------------------------------------------------------------
 * Backfill IDEMPOTENT et NON DESTRUCTIF des métadonnées manquantes de la
 * banque d'exercices (`public.exercices`) : colonnes `theme` et `contexte_irn`.
 *
 * POURQUOI : le moteur « search-first » (supabase/functions/_shared/
 * exercise-search.ts + exercise_scoring_rules.json) s'appuie sur le thème
 * (EXCL_01 / SCORE_01) et le domaine IRN (SCORE_02). Or `theme` était nul à
 * ~97 % (18/703) et `contexte_irn` aussi, ce qui neutralisait la dimension
 * thématique du scoring. Ce script classe chaque exercice vers le VOCABULAIRE
 * CANONIQUE puis remplit UNIQUEMENT les champs vides.
 *
 * VOCABULAIRE CANONIQUE (source = contrainte CHECK `chk_exercices_theme_v4`
 * sur exercices.theme, qui fait autorité) :
 *   logement | sante | travail | transport | banque | prefecture | ecole | vie_citoyenne
 * (Les noms domaine_irn du référentiel admin/citoyennete/social sont mappés
 *  vers ce vocabulaire : admin->prefecture, citoyennete->vie_citoyenne,
 *  social->vie_citoyenne.)
 *
 * MÉTHODE D'INFÉRENCE : classification lexicale déterministe. Le score d'un
 * domaine = nombre d'occurrences de ses mots-clés (accents retirés, minuscule)
 * dans les CHAMPS D'INTENTION uniquement (titre + consigne + sous_competence +
 * objectif_tcf + contexte_irn) — le `contenu` est volontairement EXCLU pour
 * éviter les faux positifs sur des lieux/objets cités incidemment (ex. « école »
 * ou « sortie du métro » mentionnés dans un texte support). Le faux-ami
 * « emploi du temps » est soustrait du score `travail`.
 * Acceptation : on remplit si best_score >= 2, OU best_score == 1 sans domaine
 * concurrent. Sinon on laisse VIDE (compté « non classé ») — règle prudente :
 * ne jamais poser une valeur douteuse. theme = contexte_irn = domaine inféré.
 *
 * IDEMPOTENCE / SÉCURITÉ :
 *  - N'écrit QUE les lignes où `theme` est NULL/vide ; `contexte_irn` n'est
 *    écrit que s'il est lui-même NULL/vide (jamais d'écrasement).
 *  - Avant toute écriture de masse, exporte l'état AVANT + le mapping prévu
 *    dans scripts/backups/backfill-exercices-metadata.manifest.json.
 *
 * ROLLBACK (annulation) : les lignes remplies par ce backfill ont
 * theme == contexte_irn. Les 18 lignes pré-existantes (theme='logement',
 * contexte_irn='agence_immo'...) ne sont donc pas concernées.
 *   UPDATE public.exercices SET theme = NULL, contexte_irn = NULL
 *   WHERE theme = contexte_irn
 *     AND theme IN ('logement','sante','travail','transport','banque','prefecture','ecole','vie_citoyenne');
 *
 * USAGE :
 *   # Aperçu (aucune écriture) — affiche la distribution et des exemples :
 *   node scripts/backfill-exercices-metadata.mjs --dry-run
 *
 *   # Application (écrit en base, idempotent) :
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     node scripts/backfill-exercices-metadata.mjs --apply
 *
 * NB : le backfill de production a été appliqué via le MCP Supabase
 * (execute_sql) avec exactement cette logique ; ce script est conservé pour la
 * MAINTENANCE (ré-exécution idempotente quand de nouveaux exercices sans thème
 * sont ajoutés).
 */

import { writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const CANONICAL_THEMES = [
  "logement", "sante", "travail", "transport", "banque", "prefecture", "ecole", "vie_citoyenne",
];

/** Taxonomie : [domaine, regex mots-clés, priorité (départage les égalités)]. */
const TAXONOMY = [
  ["banque", /\b(banque|bancaire|virement|rib|iban|prelevement|decouvert|carte bancaire|compte bancaire|distributeur de billet|cheque|releve de compte)\b/g, 1],
  ["transport", /\b(train|bus|metro|tram|gare|sncf|ratp|billet de train|billet de bus|horaires de train|trajet|itineraire|correspondance|quai|arret de bus|station de metro|voyage|deplacement|ticket de)\b/g, 2],
  ["sante", /\b(medecin|medecine|medical|sante|maladie|malade|douleur|symptome|ordonnance|medicament|pharmaci|hopital|hospital|infirmier|soin|traitement|consultation|dentiste|vaccin|urgence|patient|posologie|carte vitale|mutuelle|rhume|fievre|generaliste|specialiste)\b/g, 3],
  ["logement", /\b(logement|appartement|loyer|proprietaire|locataire|bail|location|plombier|fuite|degat des eaux|degat|immobili|agence immo|etat des lieux|caution|demenag|copropriete|quittance|preavis|garant|chauffage|robinet|salle de bain|studio|colocation|hlm|bailleur|emmenag)\b/g, 4],
  ["ecole", /\b(ecole|scolaire|cantine|maitresse|institutrice|college|lycee|maternelle|inscription scolaire|parent.{0,3}eleve|reunion de parents|rentree scolaire|bulletin scolaire)\b/g, 5],
  ["travail", /\b(travail|emploi|embauche|cv|curriculum|contrat de travail|salaire|collegue|employeur|patron|pole emploi|metier|profession|chomage|fiche de paie|bulletin de paie|stage|recrutement|cdd|cdi|licenciement|candidature)\b/g, 6],
  ["prefecture", /\b(caf|allocataire|prefecture|prefet|guichet|formulaire|titre de sejour|carte de sejour|carte de resident|recepisse|naturalisation|administration|administratif|piece justificative|justificatif|attestation|impots|ofii|service public|carte d identite|carte nationale|renouvellement|titre_sejour|mairie|demarche administrative)\b/g, 7],
  ["vie_citoyenne", /\b(citoyen|republique|laicite|valeurs de la republique|droits et devoirs|vote|voter|election|democratie|fraternite|civique|constitution|marianne|drapeau|hymne|marseillaise|voisin|voisinage|invitation|inviter|famille|familial|amitie|ami|amie|repas entre|vie sociale)\b/g, 8],
];

const stripAccents = (s) =>
  (s ?? "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function countMatches(haystack, regex) {
  const m = haystack.match(regex);
  return m ? m.length : 0;
}

/** @returns {string|null} domaine canonique, ou null si non classé. */
export function classifyExercise(row) {
  const haystack = stripAccents(
    [row.titre, row.consigne, row.sous_competence, row.objectif_tcf, row.contexte_irn]
      .filter(Boolean)
      .join(" "),
  );
  const scored = TAXONOMY.map(([domaine, regex, prio]) => {
    let score = countMatches(haystack, regex);
    if (domaine === "travail") score -= countMatches(haystack, /\bemploi du temps\b/g);
    return { domaine, score, prio };
  }).sort((a, b) => (b.score - a.score) || (a.prio - b.prio));

  const best = scored[0];
  const second = scored[1];
  if (best.score >= 2) return best.domaine;
  if (best.score === 1 && (!second || second.score <= 0)) return best.domaine;
  return null; // non classé → laisser vide
}

const isEmpty = (v) => v == null || String(v).trim() === "";

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const dryRun = args.includes("--dry-run") || !apply;

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Variables requises : SUPABASE_URL (ou VITE_SUPABASE_URL) et SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // On ne lit que les lignes au thème vide (idempotent).
  const { data: rows, error } = await supabase
    .from("exercices")
    .select("id, titre, consigne, sous_competence, objectif_tcf, contexte_irn, theme")
    .or("theme.is.null,theme.eq.")
    .limit(5000);
  if (error) { console.error(error); process.exit(1); }

  const plan = [];
  const counts = { total: rows.length, filled: 0, unclassified: 0, byTheme: {} };
  for (const row of rows) {
    const domaine = classifyExercise(row);
    if (!domaine) { counts.unclassified++; continue; }
    counts.filled++;
    counts.byTheme[domaine] = (counts.byTheme[domaine] ?? 0) + 1;
    plan.push({ id: row.id, theme: domaine, contexte_irn: isEmpty(row.contexte_irn) ? domaine : row.contexte_irn });
  }

  console.log("Distribution prévue :", JSON.stringify(counts, null, 2));

  // Sauvegarde de sécurité (état avant + mapping prévu).
  const backupDir = resolve(__dirname, "backups");
  await mkdir(backupDir, { recursive: true });
  const manifestPath = resolve(backupDir, "backfill-exercices-metadata.manifest.json");
  await writeFile(manifestPath, JSON.stringify({
    generated_at: new Date().toISOString(),
    table: "exercices",
    fields_filled: ["theme", "contexte_irn"],
    canonical_theme_vocabulary: CANONICAL_THEMES,
    count: plan.length,
    entries: plan.map((p) => `${p.id}|${p.theme}`),
  }, null, 2));
  console.log(`Manifest écrit : ${manifestPath}`);

  if (dryRun) {
    console.log("DRY-RUN : aucune écriture. Relancer avec --apply pour appliquer.");
    return;
  }

  // Application idempotente : UPDATE ciblé par id, champs vides uniquement.
  let applied = 0;
  for (const p of plan) {
    const { error: upErr, count } = await supabase
      .from("exercices")
      .update({ theme: p.theme, contexte_irn: p.contexte_irn }, { count: "exact" })
      .eq("id", p.id)
      .or("theme.is.null,theme.eq.");
    if (upErr) { console.error(`Echec ${p.id}:`, upErr.message); continue; }
    applied += count ?? 0;
  }
  console.log(`Appliqué : ${applied} lignes mises à jour.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
