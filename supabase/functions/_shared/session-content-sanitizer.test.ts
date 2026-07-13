import { describe, expect, it } from "vitest";
import { sanitizeItem, sanitizeExercice, sanitizeContentJson } from "./session-content-sanitizer.ts";

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
  });

  it("un item sans champ sensible reste inchangé pour les clés autorisées", () => {
    const sanitized = sanitizeItem({ question: "Q", texte: "T", enonce: "E", consigne: "C", options: ["a"] });
    expect(sanitized).toEqual({ question: "Q", texte: "T", enonce: "E", consigne: "C", options: ["a"] });
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
