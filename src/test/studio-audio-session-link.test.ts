import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  ownership: null as null | { data: unknown; error: null },
  existing: null as null | { data: unknown; error: null },
  lastOrdre: null as null | { data: unknown; error: null },
  insertResult: null as null | { data: unknown; error: null },
  insertPayload: null as unknown,
}));

vi.mock("@/integrations/supabase/client", () => {
  const makeSessionsQuery = () => {
    const query: any = {
      select: () => query,
      eq: () => query,
      maybeSingle: async () => state.ownership,
    };
    return query;
  };

  const makeSessionExercicesQuery = () => {
    const query: any = {
      select: () => query,
      eq: () => query,
      in: async () => state.existing,
      order: () => query,
      limit: () => query,
      maybeSingle: async () => state.lastOrdre,
      insert: (payload: unknown) => {
        state.insertPayload = payload;
        return {
          select: async () => state.insertResult,
        };
      },
    };
    return query;
  };

  return {
    supabase: {
      from: (table: string) => {
        if (table === "sessions") return makeSessionsQuery();
        if (table === "session_exercices") return makeSessionExercicesQuery();
        return makeSessionsQuery();
      },
    },
  };
});

import {
  assertSessionManagedByFormateur,
  linkPublishedVariantsToSession,
} from "@/lib/studioAudioSessionLink";

describe("studioAudioSessionLink", () => {
  beforeEach(() => {
    state.ownership = null;
    state.existing = null;
    state.lastOrdre = null;
    state.insertResult = null;
    state.insertPayload = null;
  });

  it("10. accepts a session managed by the authenticated trainer", async () => {
    state.ownership = {
      data: { id: "session-1", group_id: "g1", group: { formateur_id: "trainer-1" } },
      error: null,
    };
    const ok = await assertSessionManagedByFormateur("session-1", "trainer-1");
    expect(ok.ok).toBe(true);
  });

  it("13. refuses a session owned by another trainer", async () => {
    state.ownership = {
      data: { id: "session-2", group_id: "g2", group: { formateur_id: "other-trainer" } },
      error: null,
    };
    const result = await linkPublishedVariantsToSession({
      sessionId: "session-2",
      userId: "trainer-1",
      variants: [{ exerciseId: "ex-1" }],
    });
    expect(result.refusedCount).toBe(1);
    expect(result.outcomes[0].status).toBe("refused");
    expect(result.outcomes[0].reason).toMatch(/autre formateur/i);
    expect(state.insertPayload).toBeNull();
  });

  it("11–12. attaches published variants and stays idempotent on duplicates", async () => {
    state.ownership = {
      data: { id: "session-1", group_id: "g1", group: { formateur_id: "trainer-1" } },
      error: null,
    };
    state.existing = {
      data: [{ id: "se-existing", exercice_id: "ex-a2", ordre: 1 }],
      error: null,
    };
    state.lastOrdre = { data: { ordre: 2 }, error: null };
    state.insertResult = {
      data: [{ id: "se-new", exercice_id: "ex-b1", ordre: 3 }],
      error: null,
    };

    const first = await linkPublishedVariantsToSession({
      sessionId: "session-1",
      userId: "trainer-1",
      variants: [
        { exerciseId: "ex-a2" },
        { exerciseId: "ex-b1" },
        { exerciseId: "ex-a2" },
      ],
    });

    expect(first.alreadyPresentCount).toBe(1);
    expect(first.addedCount).toBe(1);
    expect(Array.isArray(state.insertPayload)).toBe(true);
    expect((state.insertPayload as Array<{ exercice_id: string }>)).toHaveLength(1);
    expect((state.insertPayload as Array<{ exercice_id: string }>)[0].exercice_id).toBe("ex-b1");
  });
});
