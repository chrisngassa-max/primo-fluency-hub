import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAssignedHomeworkResume } from "../../supabase/functions/_shared/assistant-pedagogique/assigned-homework.ts";
import ResumeAssignedHomeworkCard from "@/components/eleve/ResumeAssignedHomeworkCard";

const LEARNER = "10000000-0000-4000-8000-000000000001";
const OTHER = "10000000-0000-4000-8000-000000000099";
const DEVOIR_A = "30000000-0000-4000-8000-000000000001";
const DEVOIR_B = "30000000-0000-4000-8000-000000000002";
const FOREIGN = "30000000-0000-4000-8000-000000000099";
const EXO = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0101";
const EXO_B = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0102";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const APP = readFileSync(join(ROOT, "App.tsx"), "utf8");
const WRITTEN = readFileSync(join(ROOT, "components/WrittenHomeworkRoute.tsx"), "utf8");
const CARD_SRC = readFileSync(join(ROOT, "components/eleve/ResumeAssignedHomeworkCard.tsx"), "utf8");

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let container: HTMLDivElement;
let root: Root;
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  container?.remove();
  vi.restoreAllMocks();
});

function LocationProbe() {
  const location = useLocation();
  return <p data-testid="path">{location.pathname}</p>;
}

async function renderCard(resume: ReturnType<typeof buildAssignedHomeworkResume>) {
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Réseau interdit"));
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={["/eleve/devoirs"]}>
        <Routes>
          <Route
            path="/eleve/devoirs"
            element={
              <>
                <ResumeAssignedHomeworkCard resume={resume} />
                <LocationProbe />
              </>
            }
          />
          <Route path="/eleve/devoirs/:devoirId" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );
  });
  return fetchSpy;
}

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    authUserId: LEARNER,
    currentDevoirId: null,
    devoirs: [
      { id: DEVOIR_A, eleve_id: LEARNER, exercice_id: EXO, statut: "en_attente" },
    ],
    exercises: [{ id: EXO, contenu: {} }],
    decisions: [
      {
        eleve_id: LEARNER,
        reason_student: "Continue avec ton prochain devoir.",
        created_at: "2026-10-06T10:00:00Z",
        context_snapshot: { devoir_id: DEVOIR_A },
      },
    ],
    ...overrides,
  };
}

describe("Lot 2 — accueil devoir déjà attribué, sans IA", () => {
  it("devoir actif lié à un exercice : l’action ouvre la bonne activité", async () => {
    const resume = buildAssignedHomeworkResume(baseInput());
    expect(resume.status).toBe("resume");
    if (resume.status !== "resume") return;
    expect(resume.route).toBe(`/eleve/devoirs/${DEVOIR_A}`);
    expect(resume.exerciseId).toBe(EXO);
    expect(resume.reasonStudent).toBe("Continue avec ton prochain devoir.");
    const fetchSpy = await renderCard(resume);
    expect(container.textContent).toContain("Reprendre cette activité");
    expect(container.textContent).toContain("Continue avec ton prochain devoir.");
    const button = Array.from(container.querySelectorAll("a,button")).find((el) =>
      el.textContent?.includes("Reprendre cette activité"),
    );
    expect(button).toBeTruthy();
    await act(async () => (button as HTMLElement).click());
    expect(container.querySelector('[data-testid="path"]')?.textContent).toBe(`/eleve/devoirs/${DEVOIR_A}`);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("devoir absent, expiré ou invalide : état vide, aucune navigation", async () => {
    const cases = [
      buildAssignedHomeworkResume(baseInput({ devoirs: [], decisions: [] })),
      buildAssignedHomeworkResume(baseInput({
        devoirs: [{ id: DEVOIR_A, eleve_id: LEARNER, exercice_id: EXO, statut: "expire" }],
      })),
      buildAssignedHomeworkResume(baseInput({
        devoirs: [{ id: DEVOIR_A, eleve_id: LEARNER, exercice_id: "pas-un-uuid", statut: "en_attente" }],
        exercises: [],
      })),
    ];
    for (const resume of cases) {
      expect(resume.status).toBe("empty");
      const fetchSpy = await renderCard(resume);
      expect(container.textContent).toMatch(/Aucun devoir à reprendre/i);
      expect(container.textContent).not.toContain("Reprendre cette activité");
      expect(container.querySelector('[data-testid="path"]')?.textContent).toBe("/eleve/devoirs");
      expect(fetchSpy).not.toHaveBeenCalled();
      await act(async () => root.unmount());
      container.remove();
    }
  });

  it("données d’un autre élève : aucune exposition", async () => {
    const resume = buildAssignedHomeworkResume(baseInput({
      devoirs: [
        { id: FOREIGN, eleve_id: OTHER, exercice_id: EXO, statut: "en_attente" },
        { id: DEVOIR_A, eleve_id: LEARNER, exercice_id: EXO, statut: "expire" },
      ],
      decisions: [{
        eleve_id: LEARNER,
        reason_student: "SECRET_AUTRE_ELEVE",
        created_at: "2026-10-06T10:00:00Z",
        context_snapshot: { devoir_id: FOREIGN },
      }],
    }));
    expect(resume.status).toBe("empty");
    const fetchSpy = await renderCard(resume);
    expect(JSON.stringify(resume)).not.toContain(FOREIGN);
    expect(container.textContent).not.toContain(FOREIGN);
    expect(container.textContent).not.toContain("SECRET_AUTRE_ELEVE");
    expect(container.textContent).not.toContain("Reprendre cette activité");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("plusieurs devoirs admissibles : règle déterministe Lot 1 (created_at le plus récent)", async () => {
    const resume = buildAssignedHomeworkResume(baseInput({
      devoirs: [
        { id: DEVOIR_A, eleve_id: LEARNER, exercice_id: EXO, statut: "en_attente" },
        { id: DEVOIR_B, eleve_id: LEARNER, exercice_id: EXO_B, statut: "en_attente" },
      ],
      exercises: [{ id: EXO, contenu: {} }, { id: EXO_B, contenu: {} }],
      decisions: [
        {
          eleve_id: LEARNER,
          reason_student: "Ancienne décision.",
          created_at: "2026-10-01T10:00:00Z",
          context_snapshot: { devoir_id: DEVOIR_A },
        },
        {
          eleve_id: LEARNER,
          reason_student: "Décision la plus récente.",
          created_at: "2026-10-06T12:00:00Z",
          context_snapshot: { devoir_id: DEVOIR_B },
        },
      ],
    }));
    expect(resume.status).toBe("resume");
    if (resume.status !== "resume") return;
    expect(resume.devoirId).toBe(DEVOIR_B);
    expect(resume.reasonStudent).toBe("Décision la plus récente.");
    expect(resume.route).toBe(`/eleve/devoirs/${DEVOIR_B}`);
  });

  it("plusieurs devoirs sans décision liée : état ambigu, aucun choix", async () => {
    const resume = buildAssignedHomeworkResume(baseInput({
      devoirs: [
        { id: DEVOIR_A, eleve_id: LEARNER, exercice_id: EXO, statut: "en_attente" },
        { id: DEVOIR_B, eleve_id: LEARNER, exercice_id: EXO_B, statut: "en_attente" },
      ],
      exercises: [{ id: EXO, contenu: {} }, { id: EXO_B, contenu: {} }],
      decisions: [],
    }));
    expect(resume.status).toBe("ambiguous");
    const fetchSpy = await renderCard(resume);
    expect(container.textContent).toMatch(/plusieurs devoirs/i);
    expect(container.textContent).not.toContain("Reprendre cette activité");
    expect(container.querySelector('[data-testid="path"]')?.textContent).toBe("/eleve/devoirs");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("audio absent : pas de bouton d’écoute ; audio stocké : bouton présent", async () => {
    const without = buildAssignedHomeworkResume(baseInput());
    expect(without.status).toBe("resume");
    if (without.status === "resume") expect(without.hasStoredAudio).toBe(false);
    await renderCard(without);
    expect(container.textContent).not.toContain("Écouter la consigne");
    await act(async () => root.unmount());
    container.remove();

    const withAudio = buildAssignedHomeworkResume(baseInput({
      exercises: [{
        id: EXO,
        contenu: { audio: { source_id: "4a0e8321-9ece-42d7-bf76-8825b1e65e79", url: "https://storage.example/consigne.mp3" } },
      }],
    }));
    expect(withAudio.status).toBe("resume");
    if (withAudio.status === "resume") expect(withAudio.hasStoredAudio).toBe(true);
    await renderCard(withAudio);
    expect(container.textContent).toContain("Écouter la consigne");
    expect(container.textContent).not.toMatch(/Aide conversationnelle|Ouvrir l’assistant|Indice/i);
  });

  it("chemin sans appel IA et garde de consentement non contourné", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Réseau interdit"));
    const resume = buildAssignedHomeworkResume(baseInput());
    await renderCard(resume);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(CARD_SRC).not.toMatch(/gemini|captcf-assistant-qa|callAI/i);
    expect(APP).toMatch(/path="devoirs"\s+element=\{<EleveDevoirs \/>\}/);
    expect(APP).not.toMatch(/path="devoirs"\s+element=\{<AIConsentRequiredRoute><EleveDevoirs/);
    expect(WRITTEN).toContain("AIConsentRequiredRoute");
    expect(WRITTEN).toContain("isDeterministicWrittenHomework");
    expect(CARD_SRC).not.toContain("AIConsentRequiredRoute");
  });
});
