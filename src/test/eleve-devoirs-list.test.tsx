import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";

const LEARNER = "10000000-0000-4000-8000-000000000001";
const DEVOIR_A = "30000000-0000-4000-8000-000000000001";
const DEVOIR_B = "30000000-0000-4000-8000-000000000002";
const EXO = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0101";

const state = vi.hoisted(() => ({
  devoirsResult: null as { data: unknown; error: null } | Promise<{ data: unknown; error: null }> | null,
  navigate: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: LEARNER } }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const q: Record<string, unknown> = {};
      const self = () => q;
      q.select = self;
      q.eq = self;
      q.neq = self;
      q.in = self;
      q.order = self;
      q.limit = self;
      q.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
        if (table === "devoirs") {
          return Promise.resolve(state.devoirsResult ?? { data: [], error: null }).then(resolve, reject);
        }
        if (table === "routing_decisions") {
          return Promise.resolve({ data: [], error: null }).then(resolve, reject);
        }
        if (table === "resultats") {
          return Promise.resolve({ data: [], error: null }).then(resolve, reject);
        }
        return Promise.resolve({ data: [], error: null }).then(resolve, reject);
      };
      return q;
    },
  },
}));
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => state.navigate };
});

import EleveDevoirs from "@/pages/eleve/Devoirs";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let container: HTMLDivElement;
let root: Root;
let client: QueryClient;

beforeEach(() => {
  state.devoirsResult = { data: [], error: null };
  state.navigate.mockReset();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  container.remove();
});

async function renderPage() {
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <TooltipProvider>
          <MemoryRouter>
            <EleveDevoirs />
          </MemoryRouter>
        </TooltipProvider>
      </QueryClientProvider>,
    );
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
}

describe("Liste devoirs élève — chargement et Reprendre", () => {
  it("n’affiche pas « aucun devoir » pendant le chargement", async () => {
    let resolveDevoirs!: (value: { data: unknown; error: null }) => void;
    state.devoirsResult = new Promise((resolve) => {
      resolveDevoirs = resolve;
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <TooltipProvider>
            <MemoryRouter>
              <EleveDevoirs />
            </MemoryRouter>
          </TooltipProvider>
        </QueryClientProvider>,
      );
    });

    expect(container.textContent).toContain("Chargement de tes devoirs");
    expect(container.textContent).not.toContain("Aucun devoir en attente");
    expect(container.textContent).not.toContain("Aucun devoir pour l'instant");

    await act(async () => {
      resolveDevoirs({
        data: [
          {
            id: DEVOIR_A,
            eleve_id: LEARNER,
            exercice_id: EXO,
            statut: "en_attente",
            date_echeance: "2026-12-01",
            exercice: { id: EXO, titre: "Écoute Louise", competence: "CO", contenu: {} },
          },
        ],
        error: null,
      });
      await new Promise((resolve) => setTimeout(resolve, 30));
    });

    expect(container.textContent).toContain("1 devoir en attente");
    expect(container.textContent).toContain("Écoute Louise");
    expect(container.textContent).not.toContain("Aucun devoir en attente");
  });

  it("propose Reprendre sur chaque devoir sans choisir arbitrairement", async () => {
    state.devoirsResult = {
      data: [
        {
          id: DEVOIR_A,
          eleve_id: LEARNER,
          exercice_id: EXO,
          statut: "en_attente",
          date_echeance: "2026-12-01",
          exercice: { id: EXO, titre: "Devoir A", competence: "CO", contenu: {} },
        },
        {
          id: DEVOIR_B,
          eleve_id: LEARNER,
          exercice_id: EXO,
          statut: "en_attente",
          date_echeance: "2026-12-02",
          exercice: { id: EXO, titre: "Devoir B", competence: "CO", contenu: {} },
        },
      ],
      error: null,
    };

    await renderPage();

    const resumeButtons = Array.from(container.querySelectorAll("button")).filter((b) =>
      (b.textContent ?? "").includes("Reprendre"),
    );
    expect(resumeButtons.length).toBeGreaterThanOrEqual(2);
    expect(container.textContent).toMatch(/Plusieurs devoirs|Demande à ton formateur/i);

    await act(async () => {
      resumeButtons[1].click();
    });
    expect(state.navigate).toHaveBeenCalledWith(`/eleve/devoirs/${DEVOIR_B}`);
  });
});
