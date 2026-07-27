/**
 * Validateur d'exercices IA — vérifie audio, visuel, pédagogie et conformité TCF IRN.
 * Utilisé par tous les flux de génération (devoirs, bilans, exercices) avant envoi.
 */

import { callAI } from "./ai-client.ts";
import { computeExerciseDuration } from "./exercise-duration.ts";
import { validateExerciseCoherence } from "./exercise-coherence-validator.mjs";
import instructionQualityRules from "./referential/instruction_quality_rules_v1.json" with { type: "json" };

export interface ExerciseLike {
  titre?: string;
  consigne?: string;
  competence?: string;
  format?: string;
  difficulte?: number;
  niveau_vise?: string;
  contenu?: any;
  metadata?: any;
  script_audio?: string;
  image_description?: string;
  [key: string]: any;
}

export interface ValidationIssue {
  code: string;
  severity: "error" | "warning";
  message: string;
  field?: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

// TCF IRN cartographie : durées attendues (secondes)
const TCF_DURATIONS: Record<string, [number, number]> = {
  CO1: [30, 60], CO2: [40, 70], CO3: [30, 60], CO4: [40, 70],
  CE1: [60, 100], CE2: [60, 100], CE3: [60, 100], CE4: [80, 130],
  EO1: [90, 150], EO2: [120, 220], EO3: [90, 150], EO4: [90, 150],
  EE1: [240, 360], EE2: [480, 720], EE3: [480, 720],
};

const VALID_COMPETENCES = ["CO", "CE", "EE", "EO", "Structures"];
const VALID_FORMATS = ["qcm", "vrai_faux", "appariement", "texte_lacunaire", "transformation", "production_ecrite", "production_orale"];

/**
 * Validation déterministe : audio, visuel, structure, cohérence pédagogique, conformité TCF.
 */
export function validateExercise(ex: ExerciseLike): ValidationResult {
  const issues: ValidationIssue[] = [];

  // ── Champs obligatoires ──
  if (!ex.titre?.trim()) issues.push({ code: "missing_title", severity: "error", message: "Titre manquant" });
  if (!ex.consigne?.trim()) issues.push({ code: "missing_consigne", severity: "error", message: "Consigne manquante" });
  if (!ex.competence || !VALID_COMPETENCES.includes(ex.competence)) {
    issues.push({ code: "invalid_competence", severity: "error", message: `Compétence invalide: ${ex.competence}` });
  }
  if (ex.format && !VALID_FORMATS.includes(ex.format)) {
    issues.push({ code: "invalid_format", severity: "error", message: `Format invalide: ${ex.format}` });
  }

  // ── Consigne mobile-first : plafond progressif par niveau ──
  // Politique mobile-first commune au referentiel des consignes : plafond
  // progressif par niveau, en avertissement seulement (jamais de troncature).
  if (ex.consigne) {
    const maxCharacters = instructionQualityRules.max_instruction_characters[ex.niveau_vise || "A2"] ?? 280;
    if (ex.consigne.length > maxCharacters) {
      issues.push({
        code: "INSTRUCTION_TOO_COMPLEX",
        severity: "warning",
        message: `Consigne trop longue pour ${ex.niveau_vise || "A2"} (${ex.consigne.length}/${maxCharacters} caracteres)`,
      });
    }
  }

  const contenu = ex.contenu || {};
  const items: any[] = Array.isArray(contenu.items) ? contenu.items : [];
  const firstText = (...values: unknown[]) =>
    values.find((value): value is string => typeof value === "string" && value.trim().length > 0)?.trim() || "";

  // ── Audio (CO) ──
  if (ex.competence === "CO") {
    const script = firstText(contenu.script_audio, contenu.audio_script, contenu.support_audio, ex.script_audio);
    const audioUrl = firstText(contenu.audio_url, contenu.url_audio, contenu.audio_src);
    if (!script && !audioUrl) {
      issues.push({ code: "missing_audio_script", severity: "error", field: "contenu.script_audio", message: "CO sans script ni fichier audio : le bouton d'écoute ne peut pas fonctionner" });
    } else if (script.length > 600) {
      issues.push({ code: "audio_script_too_long", severity: "warning", message: "Script audio > 600 caractères (lecture > 60s)" });
    }
  }

  // ── Visuel : si image_description présente, doit être cohérente ──
  const imageDesc = contenu.image_description || ex.image_description;
  if (imageDesc && typeof imageDesc === "string" && imageDesc.trim().length < 5) {
    issues.push({ code: "invalid_image_description", severity: "warning", message: "Description d'image vide ou trop courte" });
  }

  // ── CE : texte support obligatoire ──
  if (ex.competence === "CE") {
    const texte = firstText(contenu.texte, contenu.texte_support, contenu.support_texte, contenu.document, contenu.support, contenu.enonce, contenu.contexte);
    if (!texte) {
      issues.push({ code: "missing_ce_text", severity: "error", field: "contenu.texte", message: "CE sans texte support visible" });
    }
  }

  if (ex.competence === "EE" && ex.format !== "production_ecrite") {
    issues.push({ code: "missing_writing_control", severity: "error", field: "format", message: "EE doit utiliser production_ecrite pour afficher la zone de rédaction" });
  }

  if (ex.competence === "EO" && ex.format !== "production_orale") {
    issues.push({ code: "missing_recording_control", severity: "error", field: "format", message: "EO doit utiliser production_orale pour afficher l'enregistreur" });
  }

  // ── Items (formats interactifs) ──
  const needsItems = ["qcm", "vrai_faux", "appariement", "texte_lacunaire", "transformation"].includes(ex.format || "");
  if (needsItems) {
    if (items.length === 0) {
      issues.push({ code: "no_items", severity: "error", message: "Aucun item dans l'exercice" });
    } else {
      items.forEach((item, idx) => {
        if (!item.question?.trim()) {
          issues.push({ code: "item_no_question", severity: "error", message: `Item ${idx + 1}: question manquante` });
        }
        if (item.bonne_reponse === undefined || item.bonne_reponse === null || item.bonne_reponse === "") {
          issues.push({ code: "item_no_answer", severity: "error", message: `Item ${idx + 1}: bonne_reponse manquante` });
        }
        // QCM : bonne_reponse doit être dans options
        if (ex.format === "qcm") {
          if (!Array.isArray(item.options) || item.options.length < 2) {
            issues.push({ code: "qcm_no_options", severity: "error", message: `Item ${idx + 1}: QCM doit avoir ≥ 2 options` });
          } else {
            const answers = Array.isArray(item.bonne_reponse) ? item.bonne_reponse : [item.bonne_reponse];
            for (const a of answers) {
              if (!item.options.some((o: any) => String(o).trim().toLowerCase() === String(a).trim().toLowerCase())) {
                issues.push({ code: "qcm_answer_not_in_options", severity: "error", message: `Item ${idx + 1}: bonne_reponse "${a}" absente des options` });
              }
            }
          }
        }
        // Vrai/Faux
        if (ex.format === "vrai_faux") {
          const v = String(item.bonne_reponse).toLowerCase();
          if (!["vrai", "faux", "true", "false"].includes(v)) {
            issues.push({ code: "vf_invalid_answer", severity: "error", message: `Item ${idx + 1}: réponse vrai/faux invalide` });
          }
        }
      });
    }
  }

  // ── Conformité TCF IRN (metadata.code) ──
  // Coherence finale consigne -> format -> items -> reponses -> correction.
  // Les codes et severites viennent du contrat JSON partage Node/Deno.
  const coherence = validateExerciseCoherence(ex);
  for (const coherenceRule of coherence.rules) {
    if (coherenceRule.status === "pass") continue;
    issues.push({
      code: coherenceRule.rule_id,
      severity: coherenceRule.status === "fail" ? "error" : "warning",
      field: coherenceRule.scope,
      message: coherenceRule.errors.join(" | ") || coherenceRule.rule_id,
    });
  }

  const code = ex.metadata?.code;
  if (code && TCF_DURATIONS[code]) {
    const [min, max] = TCF_DURATIONS[code];
    const dur = ex.metadata?.time_limit_seconds;
    if (typeof dur === "number" && (dur < min * 0.7 || dur > max * 1.3)) {
      issues.push({ code: "tcf_duration_off", severity: "warning", message: `Code ${code}: durée ${dur}s hors plage TCF [${min}-${max}]` });
    }
  }

  // ── Cohérence volume/durée (toute compétence, avec ou sans code TCF) ──
  // Détecte le cas "3 questions / 12 minutes" : compare la durée stockée à la
  // durée recalculée à partir du contenu réel. Un écart > 2x dans un sens ou
  // l'autre est une erreur bloquante, pas un simple avertissement — un
  // minuteur incohérent dégrade directement l'expérience de l'élève.
  const storedDuration = ex.metadata?.time_limit_seconds;
  if (typeof storedDuration === "number") {
    const expectedDuration = computeExerciseDuration({
      competence: ex.competence,
      format: ex.format,
      metadata: ex.metadata,
      contenu: ex.contenu,
      nombre_ecoutes_max: ex.nombre_ecoutes_max,
    });
    const ratio = storedDuration / Math.max(expectedDuration, 1);
    if (ratio > 2 || ratio < 0.5) {
      issues.push({
        code: "duration_volume_mismatch",
        severity: "error",
        field: "metadata.time_limit_seconds",
        message: `Durée stockée ${storedDuration}s incohérente avec le contenu (attendu ~${expectedDuration}s pour ${items.length} item(s))`,
      });
    }
  }

  // ── Difficulté ──
  if (typeof ex.difficulte === "number" && (ex.difficulte < 1 || ex.difficulte > 10)) {
    issues.push({ code: "invalid_difficulty", severity: "error", message: `Difficulté ${ex.difficulte} hors [1-10]` });
  }

  const ok = !issues.some(i => i.severity === "error");
  return { ok, issues };
}

/**
 * Régénère un exercice fautif via IA en demandant explicitement de corriger les problèmes signalés.
 * Retourne null si la régénération échoue.
 */
export async function regenerateExercise(
  original: ExerciseLike,
  issues: ValidationIssue[],
  context: { niveau?: string; demarche?: string } = {}
): Promise<ExerciseLike | null> {
  const issuesText = issues.map(i => `- [${i.severity}] ${i.message}${i.field ? ` (${i.field})` : ""}`).join("\n");

  const systemPrompt = `Tu es un expert FLE TCF IRN. Tu reçois un exercice contenant des erreurs et tu dois le RÉÉCRIRE entièrement en corrigeant TOUS les problèmes signalés.

RÈGLES STRICTES :
- CO : "script_audio" obligatoire dans contenu (texte cohérent avec la question, 30-60s de lecture)
- CE : "texte" obligatoire dans contenu (texte support cohérent)
- QCM : bonne_reponse DOIT être présente dans options (correspondance exacte)
- Vrai/Faux : bonne_reponse = "vrai" ou "faux"
- Consigne : max 12 mots, impératif simple (« Choisis », « Écoute »)
- Tous les items doivent avoir question + bonne_reponse
- Image_description : cohérente avec la question si présente
- Conserve le titre, la compétence, le format et la difficulté de l'original
- Ne modifie jamais les faits, le texte support, le script audio, la source, les identifiants civiques ni leur provenance
- Si une correction structurelle exige de changer un fait ou le support, ne publie pas l'exercice
- Niveau cible : ${context.niveau || original.niveau_vise || "A1"}
- Contexte : TCF IRN ${context.demarche || ""}`;

  const userPrompt = `EXERCICE ORIGINAL (avec erreurs) :
${JSON.stringify(original, null, 2)}

PROBLÈMES À CORRIGER :
${issuesText}

Réécris l'exercice complet en corrigeant tous les problèmes.`;

  try {
    const data = await callAI({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [{
        type: "function",
        function: {
          name: "fix_exercise",
          description: "Réécrit un exercice en corrigeant tous les problèmes",
          parameters: {
            type: "object",
            properties: {
              titre: { type: "string" },
              consigne: { type: "string" },
              competence: { type: "string", enum: VALID_COMPETENCES },
              format: { type: "string", enum: VALID_FORMATS },
              difficulte: { type: "integer", minimum: 1, maximum: 5 },
              contenu: {
                type: "object",
                properties: {
                  texte: { type: "string" },
                  script_audio: { type: "string" },
                  image_description: { type: "string" },
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        question: { type: "string" },
                        options: { type: "array", items: { type: "string" } },
                        bonne_reponse: { type: "string" },
                        explication: { type: "string" },
                      },
                      required: ["question", "bonne_reponse"],
                    },
                  },
                },
              },
            },
            required: ["titre", "consigne", "competence", "format", "contenu"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "fix_exercise" } },
    });

    const tc = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!tc) return null;
    const fixed = JSON.parse(tc.function.arguments);
    // Conserve les métadonnées originales (code, skill, etc.) MAIS recalcule
    // systématiquement time_limit_seconds à partir du contenu corrigé : sinon,
    // si le problème signalé était justement une durée incohérente avec le
    // nombre d'items, on la fige pour de bon (régénération inutile, 3 tentatives
    // perdues, exercice exclu en silence — pire que le bug d'origine).
    const recomputedSeconds = computeExerciseDuration({
      competence: fixed.competence ?? original.competence,
      format: fixed.format ?? original.format,
      metadata: original.metadata,
      contenu: fixed.contenu,
      nombre_ecoutes_max: original.nombre_ecoutes_max,
    });
    return {
      ...original,
      ...fixed,
      metadata: {
        ...(original.metadata ?? {}),
        time_limit_seconds: recomputedSeconds,
      },
    };
  } catch (e) {
    console.error("regenerateExercise failed:", e);
    return null;
  }
}

/**
 * Pipeline complet : valide, régénère jusqu'à 3 fois, exclut si échec.
 * Retourne { exercise, attempts, finalIssues } ou null si exclu.
 */
export async function validateAndFix(
  ex: ExerciseLike,
  context: { niveau?: string; demarche?: string } = {},
  maxAttempts = 3
): Promise<{ exercise: ExerciseLike; attempts: number; warnings: ValidationIssue[] } | null> {
  let current = ex;
  let attempt = 0;

  while (attempt <= maxAttempts) {
    const result = validateExercise(current);
    const structuralErrors = result.issues.filter((issue) => issue.severity === "error" && issue.code.startsWith("COHERENCE_"));
    if (structuralErrors.length > 0) {
      console.warn(`[validator] Structural review required for "${current.titre}":`, structuralErrors.map((issue) => issue.code).join(", "));
      return null;
    }
    if (result.ok) {
      const warnings = result.issues.filter(i => i.severity === "warning");
      return { exercise: current, attempts: attempt, warnings };
    }
    if (attempt === maxAttempts) {
      console.warn(`[validator] Excluded after ${attempt} attempts:`, result.issues.map(i => i.code).join(", "));
      return null;
    }
    attempt++;
    console.log(`[validator] Attempt ${attempt}/${maxAttempts} for "${current.titre}":`, result.issues.map(i => i.code).join(", "));
    const fixed = await regenerateExercise(current, result.issues, context);
    if (!fixed) {
      console.warn(`[validator] Regeneration failed at attempt ${attempt}`);
      return null;
    }
    current = fixed;
  }
  return null;
}
