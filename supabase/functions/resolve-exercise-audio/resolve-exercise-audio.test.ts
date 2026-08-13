import { describe, expect, it, vi } from "vitest";
import { handleResolveExerciseAudio } from "../_shared/resolve-exercise-audio-handler.ts";

const LEARNER = "learner-1";
const OTHER = "learner-2";
const OWNER = "formateur-1";
const ADMIN = "admin-1";
const EXERCISE = "ex-1";
const SESSION = "S01";
const DEVOIR = "devoir-1";
const PLAY_TOKEN = "play-token-valid";

function chain(result: { data: unknown; error?: unknown }) {
  const payload = { data: result.data, error: result.error ?? null };
  const api: Record<string, unknown> = {};
  api.select = vi.fn(() => api);
  api.eq = vi.fn(() => api);
  api.in = vi.fn(() => api);
  api.maybeSingle = vi.fn(async () => ({
    data: Array.isArray(payload.data) ? payload.data[0] ?? null : payload.data,
    error: payload.error,
  }));
  api.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve(payload).then(resolve, reject);
  return api;
}

function makeAdmin(rows: Record<string, { data: unknown; error?: unknown }>, admins: string[] = []) {
  return {
    from: vi.fn((table: string) => chain(rows[table] ?? { data: null })),
    rpc: vi.fn(async (_fn: string, args: { uid?: string }) => ({
      data: Boolean(args.uid && admins.includes(args.uid)),
      error: null,
    })),
  };
}

function resolvedAudio() {
  return {
    status: "resolved" as const,
    url: "https://signed.example/audio.mp3",
    expiresAt: new Date(Date.now() + 600_000).toISOString(),
  };
}

async function callHandler(opts: {
  body?: unknown;
  method?: string;
  token?: string | null;
  admin?: ReturnType<typeof makeAdmin>;
  getUser?: (token: string) => Promise<{ id: string } | null>;
  resolveAudio?: ReturnType<typeof vi.fn>;
}) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const req = new Request("https://example.test/resolve-exercise-audio", {
    method: opts.method ?? "POST",
    headers,
    body: opts.method === "GET" || opts.method === "OPTIONS" ? undefined : JSON.stringify(opts.body ?? {}),
  });
  const resolveAudio = opts.resolveAudio ?? vi.fn(async () => resolvedAudio());
  const res = await handleResolveExerciseAudio(req, {
    admin: (opts.admin ?? makeAdmin({})) as never,
    getUser: opts.getUser ?? (async (token) => (token === "jwt-learner" ? { id: LEARNER } : token === "jwt-owner" ? { id: OWNER } : token === "jwt-admin" ? { id: ADMIN } : token === "jwt-other" ? { id: OTHER } : null)),
    resolveAudio: resolveAudio as never,
  });
  const json = await res.clone().json().catch(() => null);
  return { res, json, resolveAudio };
}

function expectNoStore(res: Response) {
  expect(res.headers.get("Cache-Control")).toBe("no-store");
}

describe("resolve-exercise-audio handler", () => {
  it("contexte absent → 400 AUTH_CONTEXT_AMBIGUOUS", async () => {
    const { res, json } = await callHandler({
      body: { exercise_id: EXERCISE },
      token: "jwt-learner",
    });
    expect(res.status).toBe(400);
    expect(json).toEqual({ error: "AUTH_CONTEXT_AMBIGUOUS" });
    expectNoStore(res);
  });

  it("contexte multiple → 400 AUTH_CONTEXT_AMBIGUOUS", async () => {
    const { res, json } = await callHandler({
      body: { exercise_id: EXERCISE, session_code: SESSION, devoir_id: DEVOIR },
      token: "jwt-learner",
    });
    expect(res.status).toBe(400);
    expect(json).toEqual({ error: "AUTH_CONTEXT_AMBIGUOUS" });
    expectNoStore(res);
  });

  it("séance sans JWT → 401", async () => {
    const { res, json } = await callHandler({
      body: { exercise_id: EXERCISE, session_code: SESSION },
      token: null,
    });
    expect(res.status).toBe(401);
    expect(json).toEqual({ error: "AUTHENTIFICATION_REQUIRED" });
    expectNoStore(res);
  });

  it("élève inscrit + exercice rattaché → autorisé", async () => {
    const admin = makeAdmin({
      training_sessions: { data: { id: "ts-1" } },
      sessions: { data: [{ id: "sess-1", group_id: "g-1", group: { niveau: "A2" } }] },
      group_members: { data: [{ group_id: "g-1" }] },
      session_document_links: { data: { id: "link-1" } },
    });
    const { res, json, resolveAudio } = await callHandler({
      body: { exercise_id: EXERCISE, session_code: SESSION },
      token: "jwt-learner",
      admin,
    });
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.audio_url).toContain("signed.example");
    expect(resolveAudio).toHaveBeenCalled();
    expectNoStore(res);
  });

  it("élève inscrit mais exercice absent de la séance → 403", async () => {
    const admin = makeAdmin({
      training_sessions: { data: { id: "ts-1" } },
      sessions: { data: [{ id: "sess-1", group_id: "g-1", group: { niveau: "A2" } }] },
      group_members: { data: [{ group_id: "g-1" }] },
      session_document_links: { data: null },
    });
    const { res, json } = await callHandler({
      body: { exercise_id: EXERCISE, session_code: SESSION },
      token: "jwt-learner",
      admin,
    });
    expect(res.status).toBe(403);
    expect(json).toEqual({ error: "EXERCISE_NOT_IN_SESSION" });
    expectNoStore(res);
  });

  it("devoir appartenant à l'élève → autorisé", async () => {
    const admin = makeAdmin({
      devoirs: { data: { id: DEVOIR } },
    });
    const { res, json } = await callHandler({
      body: { exercise_id: EXERCISE, devoir_id: DEVOIR },
      token: "jwt-learner",
      admin,
    });
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expectNoStore(res);
  });

  it("devoir d'un autre élève → 403", async () => {
    const admin = makeAdmin({
      devoirs: { data: null },
    });
    const { res, json } = await callHandler({
      body: { exercise_id: EXERCISE, devoir_id: DEVOIR },
      token: "jwt-other",
      admin,
    });
    expect(res.status).toBe(403);
    expect(json).toEqual({ error: "DEVOIR_FORBIDDEN" });
    expectNoStore(res);
  });

  it("play_token valide sans JWT → autorisé", async () => {
    const admin = makeAdmin({
      exercices: { data: { id: EXERCISE } },
    });
    const { res, json } = await callHandler({
      body: { exercise_id: EXERCISE, play_token: PLAY_TOKEN },
      token: null,
      admin,
    });
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expectNoStore(res);
  });

  it("play_token invalide → refusé", async () => {
    const admin = makeAdmin({
      exercices: { data: null },
    });
    const { res, json } = await callHandler({
      body: { exercise_id: EXERCISE, play_token: "bad-token" },
      token: null,
      admin,
    });
    expect(res.status).toBe(403);
    expect(json).toEqual({ error: "PLAY_TOKEN_INVALID" });
    expectNoStore(res);
  });

  it("preview propriétaire → autorisée", async () => {
    const admin = makeAdmin({
      exercices: { data: { formateur_id: OWNER } },
    });
    const { res, json } = await callHandler({
      body: { exercise_id: EXERCISE, preview: true },
      token: "jwt-owner",
      admin,
    });
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expectNoStore(res);
  });

  it("preview admin → autorisée", async () => {
    const admin = makeAdmin(
      { exercices: { data: { formateur_id: OWNER } } },
      [ADMIN],
    );
    const { res, json } = await callHandler({
      body: { exercise_id: EXERCISE, preview: true },
      token: "jwt-admin",
      admin,
    });
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expectNoStore(res);
  });

  it("preview d'un autre formateur → 403", async () => {
    const admin = makeAdmin({
      exercices: { data: { formateur_id: OWNER } },
    });
    const { res, json } = await callHandler({
      body: { exercise_id: EXERCISE, preview: true },
      token: "jwt-other",
      admin,
    });
    expect(res.status).toBe(403);
    expect(json).toEqual({ error: "PREVIEW_FORBIDDEN" });
    expectNoStore(res);
  });

  it("preview apprenant → 403", async () => {
    const admin = makeAdmin({
      exercices: { data: { formateur_id: OWNER } },
    });
    const { res, json } = await callHandler({
      body: { exercise_id: EXERCISE, preview: true },
      token: "jwt-learner",
      admin,
    });
    expect(res.status).toBe(403);
    expect(json).toEqual({ error: "PREVIEW_FORBIDDEN" });
    expectNoStore(res);
  });

  it("stale / hash divergent → 410", async () => {
    const admin = makeAdmin({
      devoirs: { data: { id: DEVOIR } },
    });
    const { res, json } = await callHandler({
      body: { exercise_id: EXERCISE, devoir_id: DEVOIR },
      token: "jwt-learner",
      admin,
      resolveAudio: vi.fn(async () => ({ status: "stale" })),
    });
    expect(res.status).toBe(410);
    expect(json).toEqual({ ok: false, status: "stale" });
    expectNoStore(res);
  });

  it("erreur Storage → 503 unavailable/STORAGE_ERROR", async () => {
    const admin = makeAdmin({
      devoirs: { data: { id: DEVOIR } },
    });
    const { res, json } = await callHandler({
      body: { exercise_id: EXERCISE, devoir_id: DEVOIR },
      token: "jwt-learner",
      admin,
      resolveAudio: vi.fn(async () => ({ status: "unavailable", code: "STORAGE_ERROR" })),
    });
    expect(res.status).toBe(503);
    expect(json).toEqual({ ok: false, status: "unavailable", code: "STORAGE_ERROR" });
    expectNoStore(res);
  });

  it("Cache-Control: no-store sur OPTIONS", async () => {
    const { res } = await callHandler({ method: "OPTIONS", body: undefined });
    expect(res.status).toBe(200);
    expectNoStore(res);
  });
});
