import { afterEach, describe, expect, it, vi } from "vitest";
import { corrigerExerciceServer } from "../../supabase/functions/_shared/correction-server";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("server oral correction", () => {
  it("forwards the oral skill and preserves the six detailed criteria", async () => {
    const criteres = {
      realisation_consigne: { score: 8, commentaire: "Consigne respectée" },
      lexique: { score: 7, commentaire: "Lexique adapté" },
      grammaire: { score: 6, commentaire: "Quelques erreurs" },
      prononciation: { score: 5, commentaire: "À confirmer avec l'audio" },
      fluidite: { score: 6, commentaire: "Débit compréhensible" },
      coherence: { score: 8, commentaire: "Réponse organisée" },
    };

    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.epreuve).toBe("EO");
      return new Response(JSON.stringify({
        score: 8,
        resultat: "correct",
        justification: "Production compréhensible.",
        criteres_oraux: criteres,
      }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await corrigerExerciceServer({
      format: "production_orale",
      competence: "EO",
      items: [{ question: "Présente-toi.", bonne_reponse: "Réponse libre attendue." }],
      answers: { 0: "Je m'appelle Samira et j'habite à Lyon." },
      supabaseUrl: "https://example.supabase.co",
      serviceRoleKey: "test-key",
    });

    expect(result.correction[0].criteres_oraux).toEqual(criteres);
    expect(result.correction[0].ia_score_raw).toBe(8);
  });
});
