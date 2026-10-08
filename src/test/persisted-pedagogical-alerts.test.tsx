import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it } from "vitest";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
import PersistedPedagogicalAlerts from "@/components/formateur/PersistedPedagogicalAlerts";
import type { PedagogicalAlertDraft, PersistedPedagogicalAlert } from "@/lib/formateur/pedagogicalAlertsApi";

type Call = { op: string; payload: Record<string, unknown> | null; filters: [string, string][] };

const row: PersistedPedagogicalAlert = {
  id: "alert-1",
  formateur_id: "formateur-1",
  eleve_id: "eleve-1",
  sous_competence: "reperer_info_explicite",
  rule_id: "repeated_failure_or_max_help_7d",
  status: "nouveau",
  motif_classement: null,
  evidence: { attempt_ids: ["attempt-1"], event_ids: [], failures_count: 3, max_help_uses: 0, reason: "3 échecs" },
  window_start: "2026-10-01T00:00:00.000Z",
  window_end: "2026-10-07T00:00:00.000Z",
};

const draft: PedagogicalAlertDraft = {
  eleveId: "eleve-1",
  sousCompetence: "reperer_info_explicite",
  ruleId: "repeated_failure_or_max_help_7d",
  reason: "3 échecs calculés",
  windowStart: row.window_start,
  windowEnd: row.window_end,
  evidence: row.evidence,
};

function client(handler: (call: Call) => { data: unknown; error: { code?: string; message?: string } | null } | Promise<never>) {
  const calls: Call[] = [];
  return {
    calls,
    from(table: string) {
      if (table !== "pedagogical_alerts") throw new Error(table);
      const call: Call = { op: "select", payload: null, filters: [] };
      calls.push(call);
      const builder = {
        select() { return builder; },
        eq(column: string, value: string) { call.filters.push([column, value]); return builder; },
        order() { return builder; },
        update(payload: Record<string, unknown>) { call.op = "update"; call.payload = payload; return builder; },
        insert(payload: Record<string, unknown>) { call.op = "insert"; call.payload = payload; return builder; },
        then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
          return Promise.resolve(handler(call)).then(resolve, reject);
        },
      };
      return builder;
    },
  };
}

let root: Root | undefined;
let container: HTMLDivElement | undefined;

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  container?.remove();
  root = undefined;
});

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

function renderPanel(db: ReturnType<typeof client>, drafts: PedagogicalAlertDraft[] = []) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      <QueryClientProvider client={queryClient}>
        <PersistedPedagogicalAlerts client={db} formateurId="formateur-1" drafts={drafts} onCompute={() => {}} />
      </QueryClientProvider>,
    );
  });
}

const button = (text: string) => [...document.querySelectorAll("button")].find((item) => item.textContent === text);

describe("alertes pédagogiques persistées", () => {
  it("affiche le chargement sans présenter le calcul local comme enregistré", async () => {
    const db = client(() => new Promise(() => {}) as Promise<never>);
    renderPanel(db, [draft]);
    expect(document.body.textContent).toContain("Chargement des alertes enregistrées");
    expect(document.body.textContent).toContain("non enregistrée");
    expect(document.body.textContent).not.toContain("Aucune alerte enregistrée");
  });

  it("affiche une erreur explicite si la table est absente", async () => {
    const db = client(() => ({ data: null, error: { code: "PGRST205", message: "Could not find the table" } }));
    renderPanel(db, [draft]);
    await flush();
    expect(document.body.textContent).toContain("table pedagogical_alerts est absente");
    expect(document.body.textContent).toContain("non enregistrée");
    expect(document.querySelector('[role="alert"]')).toBeTruthy();
  });

  it("affiche les alertes lues en base", async () => {
    const db = client(() => ({ data: [row], error: null }));
    renderPanel(db);
    await flush();
    expect(document.body.textContent).toContain("reperer_info_explicite");
    expect(document.body.textContent).toContain("nouveau");
    expect(button("Confirmer")).toBeTruthy();
  });

  it("confirme une alerte nouvelle sans réécrire les preuves", async () => {
    let phase: "list" | "update" = "list";
    const db = client((call) => {
      if (call.op === "update") {
        phase = "update";
        return { data: [{ id: row.id }], error: null };
      }
      return { data: [phase === "update" ? { ...row, status: "confirme" } : row], error: null };
    });
    renderPanel(db);
    await flush();
    await act(async () => { button("Confirmer")?.click(); });
    await flush();
    const update = db.calls.find((call) => call.op === "update");
    expect(update?.payload).toEqual({ status: "confirme" });
    expect(document.body.textContent).toContain("confirme");
  });

  it("classe seulement avec un motif", async () => {
    const confirmed = { ...row, status: "confirme" as const };
    const db = client((call) => {
      if (call.op === "update") return { data: [{ id: row.id }], error: null };
      return { data: [confirmed], error: null };
    });
    renderPanel(db);
    await flush();
    const classer = button("Classer") as HTMLButtonElement;
    expect(classer.disabled).toBe(true);
    const input = document.querySelector("input") as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, "Remédiation planifiée");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect((button("Classer") as HTMLButtonElement).disabled).toBe(false);
    await act(async () => { button("Classer")?.click(); });
    await flush();
    const update = db.calls.find((call) => call.op === "update");
    expect(update?.payload).toEqual({ status: "classe", motif_classement: "Remédiation planifiée" });
  });

  it("recharge la liste quand l’enregistrement rencontre un doublon", async () => {
    let inserts = 0;
    const db = client((call) => {
      if (call.op === "insert") {
        inserts += 1;
        return { data: null, error: { code: "23505", message: "duplicate key" } };
      }
      return { data: inserts > 0 ? [row] : [], error: null };
    });
    renderPanel(db, [draft]);
    await flush();
    expect(document.body.textContent).toContain("Aucune alerte enregistrée");
    await act(async () => { button("Enregistrer")?.click(); });
    await flush();
    expect(document.body.textContent).toContain("Alerte déjà enregistrée");
    expect(document.body.textContent).toContain("reperer_info_explicite");
    expect(inserts).toBe(1);
  });
});
