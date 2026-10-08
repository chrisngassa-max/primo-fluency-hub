import { describe, expect, it } from "vitest";
import {
  classifyAlertsError,
  classifyPedagogicalAlert,
  confirmPedagogicalAlert,
  listPedagogicalAlerts,
  PedagogicalAlertsAccessError,
  recordPedagogicalAlert,
  type PedagogicalAlertDraft,
} from "./pedagogicalAlertsApi";

type Call = { op: string; payload: Record<string, unknown> | null; filters: [string, string][] };

function client(handler: (call: Call) => { data: unknown; error: { code?: string; message?: string } | null }) {
  const calls: Call[] = [];
  return {
    calls,
    from(table: string) {
      if (table !== "pedagogical_alerts") throw new Error(table);
      const call: Call = { op: "select", payload: null, filters: [] };
      calls.push(call);
      const builder = {
        select() {
          return builder;
        },
        eq(column: string, value: string) {
          call.filters.push([column, value]);
          return builder;
        },
        order() {
          return builder;
        },
        update(payload: Record<string, unknown>) {
          call.op = "update";
          call.payload = payload;
          return builder;
        },
        insert(payload: Record<string, unknown>) {
          call.op = "insert";
          call.payload = payload;
          return builder;
        },
        then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
          return Promise.resolve(handler(call)).then(resolve, reject);
        },
      };
      return builder;
    },
  };
}

const draft: PedagogicalAlertDraft = {
  eleveId: "eleve-1",
  sousCompetence: "reperer_info_explicite",
  ruleId: "repeated_failure_or_max_help_7d",
  reason: "3 échecs",
  windowStart: "2026-10-01T00:00:00.000Z",
  windowEnd: "2026-10-07T00:00:00.000Z",
  evidence: {
    attempt_ids: ["attempt-1"],
    event_ids: [],
    failures_count: 3,
    max_help_uses: 0,
    reason: "3 échecs",
  },
};

describe("pedagogicalAlertsApi", () => {
  it("classe une table absente, un refus RLS et un échec réseau", () => {
    expect(classifyAlertsError({ code: "PGRST205", message: "Could not find the table" }).kind).toBe("missing_migration");
    expect(classifyAlertsError({ code: "42501", message: "new row violates row-level security policy" }).kind).toBe("rls");
    expect(classifyAlertsError({ message: "Failed to fetch" }).kind).toBe("network");
  });

  it("lit les alertes du formateur connecté", async () => {
    const db = client(() => ({
      data: [{ id: "a1", status: "nouveau", formateur_id: "formateur-1" }],
      error: null,
    }));
    const rows = await listPedagogicalAlerts(db, "formateur-1");
    expect(rows).toHaveLength(1);
    expect(db.calls[0].filters).toEqual([["formateur_id", "formateur-1"]]);
  });

  it("confirme sans toucher aux preuves, à la fenêtre ni à l’identité", async () => {
    const db = client(() => ({ data: [{ id: "a1" }], error: null }));
    await confirmPedagogicalAlert(db, "a1");
    expect(db.calls[0].op).toBe("update");
    expect(db.calls[0].payload).toEqual({ status: "confirme" });
    expect(db.calls[0].filters).toEqual([
      ["id", "a1"],
      ["status", "nouveau"],
    ]);
  });

  it("classe uniquement avec un motif, sans réécrire l’alerte", async () => {
    const db = client(() => ({ data: [{ id: "a1" }], error: null }));
    await expect(classifyPedagogicalAlert(db, "a1", "   ")).rejects.toBeInstanceOf(PedagogicalAlertsAccessError);
    expect(db.calls).toHaveLength(0);
    await classifyPedagogicalAlert(db, "a1", " Remédiation ");
    expect(db.calls[0].payload).toEqual({ status: "classe", motif_classement: "Remédiation" });
    expect(Object.keys(db.calls[0].payload ?? {}).sort()).toEqual(["motif_classement", "status"]);
  });

  it("signale un doublon 23505 sans l’avaler comme un succès silencieux", async () => {
    const db = client(() => ({
      data: null,
      error: { code: "23505", message: 'duplicate key value violates unique constraint "pedagogical_alerts_one_open_idx"' },
    }));
    await expect(recordPedagogicalAlert(db, "formateur-1", draft)).resolves.toBe("duplicate");
    expect(db.calls[0].payload).toMatchObject({
      formateur_id: "formateur-1",
      eleve_id: "eleve-1",
      status: "nouveau",
      evidence: draft.evidence,
    });
    expect(db.calls[0].payload).not.toHaveProperty("motif_classement");
  });
});
