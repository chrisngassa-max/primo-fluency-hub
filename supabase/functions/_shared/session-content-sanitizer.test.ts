import { describe, expect, it } from "vitest";
import { sanitizeItem, sanitizeExercice, sanitizeContentJson, sanitizeWorkedExample } from "./session-content-sanitizer.ts";

const SENSITIVE_KEYS = ["bonne_reponse", "explication", "justification_attendue", "criteres_evaluation", "mots_cles_attendus"];

describe("session-content-sanitizer — relecture indépendante point 1/10", () => {
  it("ne renvoie jamais bonne_reponse/explication/barème pour un item QCM", () => {
    const raw = {
      question: "Combien d'heures dure le parcours ?",
      options: ["50 heures", "80 heures", "100 heures"],
      bonne_reponse: "80 heures",
      explication: "Vous allez suivre un parcours de quatre-vingts heures.",
      justification_attendue: "Justifiez à partir du support.",
      criteres_evaluation: "critère secret",
      mots_cles_attendus: ["quatre-vingts"],
    };
    const sanitized = sanitizeItem(raw);
    for (const key of SENSITIVE_KEYS) {
      expect(sanitized).not.toHaveProperty(key);
    }
    // Les options restent visibles (l'apprenant doit pouvoir choisir) : seule
    // l'identification de la bonne réponse doit disparaître, jamais un champ
    // dédié bonne_reponse/explication qui la révélerait directement.
    expect(Object.keys(sanitized).sort()).toEqual(["options", "question"]);
    expect(sanitized.question).toBe(raw.question);
    expect(sanitized.options).toEqual(raw.options);
  });

  it("ne renvoie jamais bonne_reponse même pour un item sans options (texte_lacunaire)", () => {
    const raw = { question: "Mot manquant 1", bonne_reponse: "parcours", explication: "cf. lexique" };
    const sanitized = sanitizeItem(raw);
    expect(sanitized).not.toHaveProperty("bonne_reponse");
    expect(sanitized).not.toHaveProperty("explication");
  });

  it("sanitizeExercice nettoie tous les items et ne laisse fuiter aucune clé sensible, récursivement", () => {
    const exercice = {
      id: "ex-1",
      titre: "Civique",
      consigne: "Répondez.",
      competence: "CE",
      format: "qcm",
      niveau_vise: "A2",
      civic_content: true,
      contenu: {
        worked_example: {
          level: "A2",
          format: "qcm",
          instruction: "Choisissez une réponse.",
          question: "Quel jour vient après lundi ?",
          options: ["mardi", "jeudi"],
          response: "mardi",
          completed_response: "Le jour suivant est mardi.",
          highlighted_text: "après lundi",
          explanation_steps: ["Je repère le mot après.", "Je choisis mardi."],
          bonne_reponse: "ne doit pas passer",
          correction: { secret: true },
        },
        items: [
          { question: "Q1", options: ["A", "B"], bonne_reponse: "A", explication: "car..." },
          { question: "Q2", bonne_reponse: "B", justification_attendue: "cf regle" },
        ],
      },
    };
    const sanitized = sanitizeExercice(exercice);
    const serialized = JSON.stringify(sanitized);
    for (const key of SENSITIVE_KEYS) {
      expect(serialized).not.toContain(key);
    }
    expect(sanitized.items).toHaveLength(2);
    expect(sanitized.id).toBe("ex-1");
    expect(sanitized.worked_example?.level).toBe("A2");
    expect(sanitized.worked_example?.highlighted_text).toBe("après lundi");
    expect(sanitized.worked_example?.response).toBe("mardi");
    expect(JSON.stringify(sanitized.worked_example)).not.toContain("bonne_reponse");
    expect(JSON.stringify(sanitized.worked_example)).not.toContain("correction");
  });

  it("rejette un exemple incomplet au lieu d'exposer un contrat partiel", () => {
    expect(sanitizeWorkedExample({
      format: "qcm",
      instruction: "Choisissez.",
      question: "Question sans réponse",
      explanation_steps: ["Étape"],
    })).toBeUndefined();
  });
  it("un item sans champ sensible reste inchangé pour les clés autorisées", () => {
    const sanitized = sanitizeItem({ question: "Q", texte: "T", enonce: "E", consigne: "C", options: ["a"] });
    expect(sanitized).toEqual({ question: "Q", texte: "T", enonce: "E", consigne: "C", options: ["a"] });
  });

  it("laisse passer justification_prompt (consigne de justification, jamais un corrigé) mais bloque toujours justification_attendue", () => {
    const raw = {
      question: "Q",
      options: ["A", "B"],
      justification_prompt: "Justifiez votre réponse à partir d'un indice précis du support.",
      justification_attendue: "Justifiez à partir du support.",
      bonne_reponse: "A",
    };
    const sanitized = sanitizeItem(raw);
    expect(sanitized.justification_prompt).toBe(raw.justification_prompt);
    expect(sanitized).not.toHaveProperty("justification_attendue");
    expect(sanitized).not.toHaveProperty("bonne_reponse");
    expect(Object.keys(sanitized).sort()).toEqual(["justification_prompt", "options", "question"].sort());
  });

  it("laisse passer indice (étayage A1 réel) mais jamais correction/preuve_support/erreur_diagnostiquee (hors liste blanche)", () => {
    const raw = {
      question: "Q",
      options: ["A", "B", "C"],
      indice: "Elle se présente : « Je m'appelle Awa. Awa Diallo. »",
      correction: { bonne_reponse: "A", preuve_support: "citation secrète" },
    };
    const sanitized = sanitizeItem(raw as any);
    expect(sanitized.indice).toBe(raw.indice);
    expect(sanitized).not.toHaveProperty("correction");
  });

  it("ne transmet jamais needs_review (statut éditorial de provenance civique, jamais destiné à l'apprenant)", () => {
    const sanitized = sanitizeItem({ question: "Q", options: ["A", "B"], needs_review: true } as any);
    expect(sanitized).not.toHaveProperty("needs_review");
  });

  it("laisse passer banque_mots (mots réels non associés à un trou précis)", () => {
    const sanitized = sanitizeItem({ question: "Mot manquant 1", banque_mots: ["objectif", "parcours", "règles"] } as any);
    expect(sanitized.banque_mots).toEqual(["objectif", "parcours", "règles"]);
    expect(sanitized).not.toHaveProperty("bonne_reponse");
  });

  it("laisse passer justification_required et justification_type (pilotage UI, jamais un corrigé)", () => {
    const raw = {
      question: "Q",
      options: ["A", "B"],
      justification_prompt: "Justifiez votre réponse.",
      justification_required: true,
      justification_type: "nuance",
    };
    const sanitized = sanitizeItem(raw);
    expect(sanitized.justification_required).toBe(true);
    expect(sanitized.justification_type).toBe("nuance");
  });

  it("justification_required absent (false/non posé) ne fuite jamais en tant que champ présent", () => {
    const sanitized = sanitizeItem({ question: "Q", options: ["A"] });
    expect(sanitized).not.toHaveProperty("justification_required");
    expect(sanitized).not.toHaveProperty("justification_type");
  });

  it("ne transmet jamais bonne_reponse/expected_elements/correction modèle/explication/critères privés, avant ou après libération (sanitizeItem ne connaît pas la libération : il retire ces clés inconditionnellement)", () => {
    const raw = {
      question: "Q",
      options: ["A", "B", "C"],
      bonne_reponse: "A",
      expected_elements: ["A", "explique le contexte"],
      corrige_modele: "La réponse attendue est A car...",
      explication: "Justification interne réservée au corrigé.",
      criteres_evaluation: { bareme: 10, mots_cles: ["A"] },
      criteres_prives: "ne jamais exposer",
    };
    const sanitized = sanitizeItem(raw as any);
    for (const key of ["bonne_reponse", "expected_elements", "corrige_modele", "explication", "criteres_evaluation", "criteres_prives"]) {
      expect(sanitized).not.toHaveProperty(key);
    }
    expect(Object.keys(sanitized).sort()).toEqual(["options", "question"]);
  });
});

describe("sanitizeContentJson — 2e relecture indépendante, point 5/10", () => {
  const FORBIDDEN = ["file_url", "storage_path", "source_file_path", "bonne_reponse", "corrige", "correction", "bareme", "explication"];

  it("retire récursivement file_url/storage_path/source_file_path à toute profondeur", () => {
    const raw = {
      title: "Support",
      file_url: "https://storage/secret.pdf",
      nested: { storage_path: "bucket/secret.pdf", ok: "valeur licite" },
      list: [{ source_file_path: "/tmp/secret.pdf" }, { ok: 1 }],
    };
    const sanitized: any = sanitizeContentJson(raw);
    const serialized = JSON.stringify(sanitized);
    for (const key of FORBIDDEN) {
      expect(serialized).not.toContain(key);
    }
    expect(sanitized.title).toBe("Support");
    expect(sanitized.nested.ok).toBe("valeur licite");
    expect(sanitized.list[1].ok).toBe(1);
  });

  it("retire bonne_reponse/corrige/correction/bareme même imbriqués dans un tableau de questions", () => {
    const raw = {
      questions: [
        { question: "Q1", bonne_reponse: "A", correction: "explication secrète" },
        { question: "Q2", corrige: { bareme: 10 } },
      ],
    };
    const sanitized: any = sanitizeContentJson(raw);
    const serialized = JSON.stringify(sanitized);
    for (const key of FORBIDDEN) {
      expect(serialized).not.toContain(key);
    }
    expect(sanitized.questions[0].question).toBe("Q1");
  });

  it("laisse passer un contenu sans aucune clé sensible, inchangé", () => {
    const raw = { title: "Titre", paragraphs: ["a", "b"] };
    expect(sanitizeContentJson(raw)).toEqual(raw);
  });

  it("gère null/valeurs scalaires sans erreur", () => {
    expect(sanitizeContentJson(null)).toBeNull();
    expect(sanitizeContentJson("texte")).toBe("texte");
    expect(sanitizeContentJson(42)).toBe(42);
  });
});
