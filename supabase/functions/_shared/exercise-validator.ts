/**
 * Validateur d'exercices IA — vérifie audio, visuel, pédagogie et conformité TCF IRN.
 * Utilisé par tous les flux de génération (devoirs, bilans, exercices) avant envoi.
 */

import { callAI } from "./ai-client.ts";

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

  // ── Consigne A0/A1 : max 12 mots ──
  if (ex.consigne) {
    const wordCount = ex.consigne.trim().split(/\s+/).length;
    if (wordCount > 15) {
      issues.push({ code: "consigne_too_long", severity: "warning", message: `Consigne trop longue (${wordCount} mots, max 12)` });
    }
  }

  const contenu = ex.contenu || {};
  const items: any[] = Array.isArray(contenu.items) ? contenu.items : [];

  // ── Audio (CO) ──
  if (ex.competence === "CO") {
    const script = contenu.script_audio || ex.script_audio;
    if (!script || typeof script !== "string" || script.trim().length < 10) {
      issues.push({ code: "missing_audio_script", severity: "error", field: "contenu.script_audio", message: "CO sans script_audio valide (TTS impossible)" });
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
    const texte = contenu.texte;
    if (!texte || typeof texte !== "string" || texte.trim().length < 20) {
      issues.push({ code: "missing_ce_text", severity: "error", field: "contenu.texte", message: "CE sans texte support valide" });
    }
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
  const code = ex.metadata?.code;
  if (code && TCF_DURATIONS[code]) {
    const [min, max] = TCF_DURATIONS[code];
    const dur = ex.metadata?.time_limit_seconds;
    if (typeof dur === "number" && (dur < min * 0.7 || dur > max * 1.3)) {
      issues.push({ code: "tcf_duration_off", severity: "warning", message: `Code ${code}: durée ${dur}s hors plage TCF [${min}-${max}]` });
    }
  }

  // ── Difficulté ──
  if (typeof ex.difficulte === "number" && (ex.difficulte < 1 || ex.difficulte > 5)) {
    issues.push({ code: "invalid_difficulty", severity: "error", message: `Difficulté ${ex.difficulte} hors [1-5]` });
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
- Niveau cible : ${context.niveau || original.niveau_vise || "A1"}
- Contexte : TCF IRN ${context.demarche || ""}`;

  const userPrompt = `EXERCICE ORIGINAL (avec erreurs) :
${JSON.stringify(original, null, 2)}

PROBLÈMES À CORRIGER :
${issuesText}

Réécris l'exercice complet en corrigeant tous les problèmes.`;

  try {
    const data = await callAI({
      model: "google/gemini-3-flash-preview",
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
    // Conserve les métadonnées originales
    return { ...original, ...fixed, metadata: original.metadata };
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
