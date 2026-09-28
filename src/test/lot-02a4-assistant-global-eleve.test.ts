import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ELEVE_ROUTE_CATALOG,
  isFormateurOrAdminPath,
  matchEleveRoute,
  sensitiveContextKey,
} from "@/lib/avatar/eleveRouteCatalog";
import {
  answerPageOrientation,
  isPageOrientationQuestion,
  listDeclaredEleveRouteExamples,
  quickPromptsForPath,
} from "@/lib/avatar/answerPageOrientation";
import { answerContextualQuestion } from "@/lib/avatar/answerContextualQuestion";
import { ASSISTANT_TOOLS } from "../../supabase/functions/_shared/assistant-accueil/contract-v1";
import { modeFromStudentPath } from "../../supabase/functions/_shared/assistant-accueil/orchestrate";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const APP = readFileSync(join(ROOT, "App.tsx"), "utf8");
const ELEVE_LAYOUT = readFileSync(join(ROOT, "layouts/EleveLayout.tsx"), "utf8");
const FORMATEUR_LAYOUT = readFileSync(join(ROOT, "layouts/FormateurLayout.tsx"), "utf8");
const PANEL = readFileSync(join(ROOT, "components/eleve/AvatarAssistantPanel.tsx"), "utf8");

const AUTH = "10000000-0000-4000-8000-000000000001";

describe("Lot 2A.4 — assistant global espace élève", () => {
  it("1. catalogue couvre chaque route élève déclarée dans App.tsx", () => {
    const relative = [
      "acces-limite", "profil", "ma-seance", "mes-seances",
      "exercices-interactifs/s01", "seances/:sessionCode",
      "test-positionnement", "test-positionnement/passer/:token",
      "test-positionnement/resultat/:attemptId", "devoirs", "carnet",
      "bilan/:sessionId", "exercices-seance/:sessionId", "bilan-test/:testId",
      "bilan-devoirs/:bilanId", "devoirs/:devoirId", "progression",
    ];
    for (const rel of relative) {
      const example = rel.includes(":")
        ? `/eleve/${rel
          .replace(":sessionCode", "S01")
          .replace(":token", "jeton-demo-1")
          .replace(":attemptId", "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee")
          .replace(":sessionId", "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee")
          .replace(":testId", "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee")
          .replace(":bilanId", "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee")
          .replace(":devoirId", "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee")}`
        : `/eleve/${rel}`;
      expect(matchEleveRoute(example), example).not.toBeNull();
    }
    expect(matchEleveRoute("/eleve")).not.toBeNull();
    expect(ELEVE_ROUTE_CATALOG.length).toBeGreaterThanOrEqual(17);
    expect(listDeclaredEleveRouteExamples().some((p) => p.includes("ressources"))).toBe(false);
  });

  it("2. assistant monté dans EleveLayout, absent de FormateurLayout", () => {
    expect(ELEVE_LAYOUT).toContain("AvatarAssistantPanel");
    expect(ELEVE_LAYOUT.match(/AvatarAssistantPanel/g)?.length).toBeGreaterThanOrEqual(1);
    expect(FORMATEUR_LAYOUT).not.toContain("AvatarAssistantPanel");
    expect(FORMATEUR_LAYOUT).not.toContain("AidePedagogiqueProvider");
    expect(isFormateurOrAdminPath("/formateur/monitoring")).toBe(true);
    expect(isFormateurOrAdminPath("/eleve/devoirs")).toBe(false);
  });

  it("3. accueil : orientation séance", async () => {
    const r = await answerContextualQuestion("Quelle est ma prochaine séance ?", {
      sessionCode: null, sessionTitre: "Santé", objectif: null, niveau: "A2",
      leconTitre: null, exerciceTitre: null, exerciceConsigne: null, exerciceCompetence: null,
    }, { authUserId: AUTH, pagePath: "/eleve", authenticated: true });
    expect(r.aiInvoked).toBe(false);
    expect(r.text).toMatch(/Santé|Ma séance/i);
  });

  it("4. accueil : orientation devoirs", async () => {
    const r = await answerContextualQuestion("Où sont mes devoirs ?", {
      sessionCode: null, sessionTitre: null, objectif: null, niveau: "A2",
      leconTitre: null, exerciceTitre: null, exerciceConsigne: null, exerciceCompetence: null,
    }, {
      authUserId: AUTH,
      pagePath: "/eleve",
      authenticated: true,
      ownDevoirs: [{ id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", titre: "Logement", statut: "en_attente", eleveId: AUTH }],
    });
    expect(r.text).toMatch(/devoir/i);
    expect(r.openRoute).toBe("/eleve/devoirs");
  });

  it("5. état vide sans invention", () => {
    const r = answerPageOrientation("Que dois-je faire aujourd’hui ?", "/eleve", {
      authenticated: true,
      facts: { devoirsPendingCount: 0, prochaineSeanceTitre: null },
    });
    expect(r!.text).toMatch(/pas de devoir|n’ai pas|n'ai pas|vérifie/i);
  });

  it("6. page séance contextualisée", () => {
    const r = answerPageOrientation("Où suis-je ?", "/eleve/ma-seance", { authenticated: true });
    expect(r!.text).toMatch(/Ma séance/i);
    expect(quickPromptsForPath("/eleve/ma-seance", false).some((p) => /objectif/i.test(p.question))).toBe(true);
  });

  it("7. page devoir contextualisée", () => {
    const r = answerPageOrientation("Que signifie cet écran ?", "/eleve/devoirs", { authenticated: true });
    expect(r!.text).toMatch(/devoir/i);
    expect(quickPromptsForPath("/eleve/devoirs/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", true).some((p) => /indice/i.test(p.question))).toBe(true);
  });

  it("8. page résultats / bilan contextualisée", () => {
    const r = answerPageOrientation("Que signifie cet écran ?", "/eleve/bilan-devoirs/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", {
      authenticated: true,
    });
    expect(r!.text).toMatch(/bilan|devoir/i);
  });

  it("9. page progression contextualisée", () => {
    const r = answerPageOrientation("Que dois-je travailler ensuite ?", "/eleve/progression", {
      authenticated: true,
      facts: { devoirsPendingCount: 0, prochaineSeanceTitre: null },
    });
    expect(r!.text.length).toBeGreaterThan(20);
    expect(matchEleveRoute("/eleve/progression")?.family).toBe("progression");
  });

  it("10. pas de page ressources élève inventée", () => {
    expect(matchEleveRoute("/eleve/ressources")).toBeNull();
    expect(APP).not.toMatch(/path="\/eleve\/ressources"/);
    expect(listDeclaredEleveRouteExamples().every((p) => !p.includes("ressources"))).toBe(true);
  });

  it("11. page profil contextualisée", () => {
    const r = answerPageOrientation("À quoi sert cette page ?", "/eleve/profil", { authenticated: true });
    expect(r!.text).toMatch(/personnelles|profil|informations/i);
    expect(matchEleveRoute("/eleve/profil")?.screen).toMatch(/profil/i);
  });

  it("12. évaluation : aide technique uniquement", () => {
    const path = "/eleve/test-positionnement/passer/jeton-demo-1";
    expect(modeFromStudentPath(path)).toBe("evaluation");
    const ok = answerPageOrientation("Comment utiliser cet écran ?", path, { authenticated: true });
    expect(ok!.text).toMatch(/écran|test/i);
    const blocked = answerPageOrientation("Puis-je avoir un indice ?", path, { authenticated: true });
    expect(blocked!.refused).toBe(true);
    expect(quickPromptsForPath(path, false).every((p) => !/indice/i.test(p.question))).toBe(true);
  });

  it("13. route formateur refusée", async () => {
    const r = await answerContextualQuestion("Où suis-je ?", {
      sessionCode: null, sessionTitre: null, objectif: null, niveau: "A2",
      leconTitre: null, exerciceTitre: null, exerciceConsigne: null, exerciceCompetence: null,
    }, { authUserId: AUTH, pagePath: "/formateur/monitoring", authenticated: true });
    expect(r.refused).toBe(true);
    expect(r.text).toMatch(/espace élève/i);
  });

  it("14. route élève autorisée", () => {
    const r = answerPageOrientation("Où suis-je ?", "/eleve/carnet", { authenticated: true });
    expect(r!.refused).toBeFalsy();
    expect(r!.text).toMatch(/carnet/i);
  });

  it("15. changement de route réinitialise la clé de contexte sensible", () => {
    expect(sensitiveContextKey("/eleve", AUTH)).not.toBe(sensitiveContextKey("/eleve/devoirs", AUTH));
    expect(PANEL).toContain("sensitiveContextKey");
    expect(PANEL).toContain("requestNumber");
  });

  it("16. changement d’utilisateur réinitialise la clé", () => {
    expect(sensitiveContextKey("/eleve", "u1")).not.toBe(sensitiveContextKey("/eleve", "u2"));
    expect(PANEL).toMatch(/user\?\.id/);
  });

  it("17. réponse tardive ignorée (compteur de requête dans le panneau)", () => {
    expect(PANEL).toContain("if (request !== requestNumber.current) return");
    expect(isPageOrientationQuestion("Où suis-je ?")).toBe(true);
  });

  it("18. page en erreur / accès limité conserve l’aide", () => {
    const r = answerPageOrientation("Pourquoi cette action est-elle indisponible ?", "/eleve/acces-limite", {
      authenticated: true,
    });
    expect(r!.text).toMatch(/indisponible|accueil|professeur/i);
    expect(ELEVE_LAYOUT).toContain("AvatarAssistantPanel");
  });

  it("19. exercice Louise : sélecteurs pédagogiques préservés (Lot 2A.3)", () => {
    expect(PANEL).toContain("context.pedagogical");
    expect(PANEL).toContain("Donne-moi un indice");
    expect(PANEL).toContain("Demander au professeur");
  });

  it("20. sans banque : autres aides d’orientation disponibles", () => {
    const r = answerPageOrientation("Explique-moi la consigne.", "/eleve/devoirs/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", {
      authenticated: true,
    });
    expect(r!.text).toMatch(/consigne|exercice|devoir/i);
  });

  it("21. aucune invocation Gemini", async () => {
    const r = await answerContextualQuestion("Où suis-je ?", {
      sessionCode: null, sessionTitre: null, objectif: null, niveau: "A1",
      leconTitre: null, exerciceTitre: null, exerciceConsigne: null, exerciceCompetence: null,
    }, { authUserId: AUTH, pagePath: "/eleve/progression", authenticated: true });
    expect(r.aiInvoked).toBe(false);
  });

  it("22. aucune donnée formateur exposée", () => {
    const r = answerPageOrientation("Où suis-je ?", "/eleve", { authenticated: true });
    expect(JSON.stringify(r)).not.toMatch(/formateur_id|service_role|"admin"/i);
  });

  it("23. exactement cinq outils", () => {
    expect(ASSISTANT_TOOLS).toHaveLength(5);
  });
});
