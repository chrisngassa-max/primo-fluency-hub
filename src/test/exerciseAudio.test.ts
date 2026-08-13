import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests du service resolveExerciseAudio : décodage du corps des
 * FunctionsHttpError (404/410/403/503) et cache contextuel non persistant.
 */

// Mock du client Supabase : on contrôle invoke() pour simuler les réponses.
const invokeMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: (...args: any[]) => invokeMock(...args) },
  },
}));

// Import APRÈS le mock.
import {
  clearExerciseAudioCache,
  resolveExerciseAudio,
} from "@/lib/exerciseAudio";

function functionsHttpError(status: number, body: unknown) {
  // Reproduit la forme FunctionsHttpError : error.context = Response.
  const resp = new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
  const err: any = new Error(`FunctionsHttpError ${status}`);
  err.name = status >= 500 ? "FunctionsInternalServerError" : "FunctionsHttpError";
  err.context = resp;
  return err;
}

beforeEach(() => {
  invokeMock.mockReset();
  clearExerciseAudioCache();
  // Isoler le localStorage : on s'assure d'un état propre par test.
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

function setUserId(uid: string) {
  localStorage.setItem(
    "sb-gudcenhmzlcvhgbgklzw-auth-token",
    JSON.stringify({ user: { id: uid } }),
  );
}

describe("resolveExerciseAudio — décodage des statuts HTTP", () => {
  it("resolved : retourne l'URL signée", async () => {
    invokeMock.mockResolvedValue({
      data: { ok: true, audio_url: "https://signed/audio.mp3", expires_at: new Date(Date.now() + 600000).toISOString() },
      error: null,
    });
    setUserId("user-A");
    const res = await resolveExerciseAudio({ exerciseId: "ex-1", sessionCode: "S01" });
    expect(res.status).toBe("resolved");
    if (res.status === "resolved") expect(res.url).toBe("https://signed/audio.mp3");
  });

  it("404 -> no_original_audio", async () => {
    invokeMock.mockResolvedValue({ data: null, error: functionsHttpError(404, { ok: false, status: "no_original_audio" }) });
    setUserId("user-A");
    expect((await resolveExerciseAudio({ exerciseId: "ex-1", devoirId: "d1" })).status).toBe("no_original_audio");
  });

  it("410 -> stale", async () => {
    invokeMock.mockResolvedValue({ data: null, error: functionsHttpError(410, { ok: false, status: "stale" }) });
    setUserId("user-A");
    expect((await resolveExerciseAudio({ exerciseId: "ex-1", sessionCode: "S01" })).status).toBe("stale");
  });

  it("403 -> forbidden", async () => {
    invokeMock.mockResolvedValue({ data: null, error: functionsHttpError(403, { error: "NOT_ENROLLED" }) });
    setUserId("user-A");
    expect((await resolveExerciseAudio({ exerciseId: "ex-1", sessionCode: "S01" })).status).toBe("forbidden");
  });

  it("503 -> unavailable", async () => {
    invokeMock.mockResolvedValue({ data: null, error: functionsHttpError(503, { ok: false, status: "unavailable", code: "STORAGE_ERROR" }) });
    setUserId("user-A");
    const res = await resolveExerciseAudio({ exerciseId: "ex-1", sessionCode: "S01" });
    expect(res.status).toBe("unavailable");
    if (res.status === "unavailable") expect(res.code).toBe("STORAGE_ERROR");
  });

  it("ne transforme pas une 404 en erreur générique unavailable", async () => {
    invokeMock.mockResolvedValue({ data: null, error: functionsHttpError(404, { status: "no_original_audio" }) });
    setUserId("user-A");
    const res = await resolveExerciseAudio({ exerciseId: "ex-1", sessionCode: "S01" });
    // Critique : doit rester no_original_audio, pas unavailable.
    expect(res.status).not.toBe("unavailable");
    expect(res.status).toBe("no_original_audio");
  });
});

describe("resolveExerciseAudio — cache contextuel", () => {
  it("cache hit : aucun nouvel appel réseau", async () => {
    invokeMock.mockResolvedValue({
      data: { ok: true, audio_url: "https://signed/a.mp3", expires_at: new Date(Date.now() + 600000).toISOString() },
      error: null,
    });
    setUserId("user-A");
    await resolveExerciseAudio({ exerciseId: "ex-1", sessionCode: "S01" });
    await resolveExerciseAudio({ exerciseId: "ex-1", sessionCode: "S01" });
    expect(invokeMock).toHaveBeenCalledTimes(1);
  });

  it("contextes distincts (même exercice) -> entrées de cache séparées", async () => {
    invokeMock.mockResolvedValue({
      data: { ok: true, audio_url: "https://signed/a.mp3", expires_at: new Date(Date.now() + 600000).toISOString() },
      error: null,
    });
    setUserId("user-A");
    await resolveExerciseAudio({ exerciseId: "ex-1", sessionCode: "S01" });
    await resolveExerciseAudio({ exerciseId: "ex-1", devoirId: "d1" });
    expect(invokeMock).toHaveBeenCalledTimes(2);
  });

  it("changement d'utilisateur -> cache précédent inutilisable", async () => {
    invokeMock.mockResolvedValue({
      data: { ok: true, audio_url: "https://signed/a.mp3", expires_at: new Date(Date.now() + 600000).toISOString() },
      error: null,
    });
    setUserId("user-A");
    await resolveExerciseAudio({ exerciseId: "ex-1", sessionCode: "S01" });
    setUserId("user-B");
    await resolveExerciseAudio({ exerciseId: "ex-1", sessionCode: "S01" });
    expect(invokeMock).toHaveBeenCalledTimes(2);
  });

  it("clearExerciseAudioCache vide le cache", async () => {
    invokeMock.mockResolvedValue({
      data: { ok: true, audio_url: "https://signed/a.mp3", expires_at: new Date(Date.now() + 600000).toISOString() },
      error: null,
    });
    setUserId("user-A");
    await resolveExerciseAudio({ exerciseId: "ex-1", sessionCode: "S01" });
    clearExerciseAudioCache();
    await resolveExerciseAudio({ exerciseId: "ex-1", sessionCode: "S01" });
    expect(invokeMock).toHaveBeenCalledTimes(2);
  });
});
