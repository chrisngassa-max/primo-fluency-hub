import { describe, expect, it, vi } from "vitest";
import { resolveExerciseAudio } from "./pedagogical-source-audio.ts";

/**
 * Le résolveur reçoit un client `admin` (service-role) en paramètre. On le
 *.mocke ici pour tester la logique de décision sans dépendre d'un Deno runtime.
 */

const HASH = "sha256:abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";

function makeAdmin(overrides: {
  exercise?: any | null;
  exerciseError?: any;
  family?: any | null;
  familyError?: any;
  source?: any | null;
  sourceError?: any;
  signedUrl?: { data?: { signedUrl?: string } | null; error?: any };
}) {
  const from = vi.fn((table: string) => {
    const chain: any = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      maybeSingle: vi.fn(async () => {
        if (table === "exercices") {
          if (overrides.exerciseError) throw overrides.exerciseError;
          return { data: overrides.exercise === undefined ? null : overrides.exercise, error: null };
        }
        if (table === "differentiation_families") {
          if (overrides.familyError) throw overrides.familyError;
          return { data: overrides.family ?? null, error: null };
        }
        if (table === "pedagogical_sources") {
          if (overrides.sourceError) throw overrides.sourceError;
          return { data: overrides.source ?? null, error: null };
        }
        return { data: null, error: null };
      }),
    };
    return chain;
  });
  const storage = {
    from: vi.fn(() => ({
      createSignedUrl: vi.fn(async () =>
        overrides.signedUrl ?? { data: { signedUrl: "https://signed.example/audio.mp3" }, error: null },
      ),
    })),
  };
  return { from, storage } as any;
}

function coExercise(audioRef?: any, stale = false) {
  return {
    id: "ex-1",
    competence: "CO",
    contenu: {
      items: [],
      audio: audioRef,
      ...(stale ? { metadata: { source_stale: true } } : {}),
    },
  };
}

describe("resolveExerciseAudio — états discriminés", () => {
  it("resolved : URL signée renvoyée quand tout est cohérent", async () => {
    const admin = makeAdmin({
      exercise: coExercise({ source_id: "src-1", source_content_hash: HASH, mime_type: "audio/mpeg" }),
      family: { id: "fam-1", source_id: "src-1", source_content_hash: HASH, review_status: "published" },
      source: {
        content_hash: HASH, status: "analyzed", review_status: "valide",
        source_kind: "audio", storage_bucket: "pedagogical-sources", storage_path: "u/file.mp3",
      },
    });
    const res = await resolveExerciseAudio(admin, "ex-1");
    expect(res.status).toBe("resolved");
    if (res.status === "resolved") {
      expect(res.url).toContain("signed.example");
      expect(res.expiresAt).toBeTruthy();
    }
  });

  it("no_original_audio : exercice non-CO", async () => {
    const admin = makeAdmin({
      exercise: { id: "ex-1", competence: "CE", contenu: { audio: { source_id: "s" } } },
    });
    expect((await resolveExerciseAudio(admin, "ex-1")).status).toBe("no_original_audio");
  });

  it("no_original_audio : CO sans contenu.audio (ancien exercice)", async () => {
    const admin = makeAdmin({ exercise: coExercise(undefined) });
    expect((await resolveExerciseAudio(admin, "ex-1")).status).toBe("no_original_audio");
  });

  it("unavailable NO_PUBLISHED_FAMILY : aucune famille publiée pour cet exercice", async () => {
    const admin = makeAdmin({
      exercise: coExercise({ source_id: "src-1", source_content_hash: HASH }),
      family: null,
    });
    const res = await resolveExerciseAudio(admin, "ex-1");
    expect(res).toEqual({ status: "unavailable", code: "NO_PUBLISHED_FAMILY" });
  });

  it("unavailable AUDIO_SOURCE_MISMATCH : source_id JSON != source_id famille", async () => {
    const admin = makeAdmin({
      exercise: coExercise({ source_id: "src-malveillant", source_content_hash: HASH }),
      family: { id: "fam", source_id: "src-1", source_content_hash: HASH, review_status: "published" },
    });
    const res = await resolveExerciseAudio(admin, "ex-1");
    expect(res).toEqual({ status: "unavailable", code: "AUDIO_SOURCE_MISMATCH" });
  });

  it("unavailable SOURCE_NOT_FOUND : source absente", async () => {
    const admin = makeAdmin({
      exercise: coExercise({ source_id: "src-1", source_content_hash: HASH }),
      family: { id: "fam", source_id: "src-1", source_content_hash: HASH, review_status: "published" },
      source: null,
    });
    const res = await resolveExerciseAudio(admin, "ex-1");
    expect(res).toEqual({ status: "unavailable", code: "SOURCE_NOT_FOUND" });
  });

  it("stale : divergence de hash entre contenu.audio et famille", async () => {
    const admin = makeAdmin({
      exercise: coExercise({ source_id: "src-1", source_content_hash: "sha256:aaaa" }),
      family: { id: "fam", source_id: "src-1", source_content_hash: "sha256:bbbb", review_status: "published" },
      // La source concorde avec la famille (sha256:bbbb) : la divergence est
      // bien entre contenu.audio et les deux autres.
      source: {
        content_hash: "sha256:bbbb", status: "analyzed", review_status: "valide",
        source_kind: "audio", storage_bucket: "b", storage_path: "p",
      },
    });
    expect((await resolveExerciseAudio(admin, "ex-1")).status).toBe("stale");
  });

  it("stale : divergence de hash entre famille et source", async () => {
    const admin = makeAdmin({
      exercise: coExercise({ source_id: "src-1", source_content_hash: HASH }),
      family: { id: "fam", source_id: "src-1", source_content_hash: HASH, review_status: "published" },
      source: {
        content_hash: "sha256:différent", status: "analyzed", review_status: "valide",
        source_kind: "audio", storage_bucket: "b", storage_path: "p",
      },
    });
    expect((await resolveExerciseAudio(admin, "ex-1")).status).toBe("stale");
  });

  it("stale : marqueur source_stale=true dans contenu.metadata", async () => {
    const admin = makeAdmin({
      exercise: coExercise({ source_id: "src-1", source_content_hash: HASH }, true),
      family: { id: "fam", source_id: "src-1", source_content_hash: HASH, review_status: "published" },
      source: {
        content_hash: HASH, status: "analyzed", review_status: "valide",
        source_kind: "audio", storage_bucket: "b", storage_path: "p",
      },
    });
    expect((await resolveExerciseAudio(admin, "ex-1")).status).toBe("stale");
  });

  it("unavailable SOURCE_NOT_AUDIO : source_kind != audio", async () => {
    const admin = makeAdmin({
      exercise: coExercise({ source_id: "src-1", source_content_hash: HASH }),
      family: { id: "fam", source_id: "src-1", source_content_hash: HASH, review_status: "published" },
      source: {
        content_hash: HASH, status: "analyzed", review_status: "valide",
        source_kind: "document", storage_bucket: "b", storage_path: "p",
      },
    });
    const res = await resolveExerciseAudio(admin, "ex-1");
    expect(res).toEqual({ status: "unavailable", code: "SOURCE_NOT_AUDIO" });
  });

  it("stale : source non analysée", async () => {
    const admin = makeAdmin({
      exercise: coExercise({ source_id: "src-1", source_content_hash: HASH }),
      family: { id: "fam", source_id: "src-1", source_content_hash: HASH, review_status: "published" },
      source: {
        content_hash: HASH, status: "imported", review_status: "valide",
        source_kind: "audio", storage_bucket: "b", storage_path: "p",
      },
    });
    expect((await resolveExerciseAudio(admin, "ex-1")).status).toBe("stale");
  });

  it("stale : source review_status = a_remplacer", async () => {
    const admin = makeAdmin({
      exercise: coExercise({ source_id: "src-1", source_content_hash: HASH }),
      family: { id: "fam", source_id: "src-1", source_content_hash: HASH, review_status: "published" },
      source: {
        content_hash: HASH, status: "analyzed", review_status: "a_remplacer",
        source_kind: "audio", storage_bucket: "b", storage_path: "p",
      },
    });
    expect((await resolveExerciseAudio(admin, "ex-1")).status).toBe("stale");
  });

  it("unavailable STORAGE_REF_MISSING : storage_bucket/path vides", async () => {
    const admin = makeAdmin({
      exercise: coExercise({ source_id: "src-1", source_content_hash: HASH }),
      family: { id: "fam", source_id: "src-1", source_content_hash: HASH, review_status: "published" },
      source: {
        content_hash: HASH, status: "analyzed", review_status: "valide",
        source_kind: "audio", storage_bucket: null, storage_path: null,
      },
    });
    const res = await resolveExerciseAudio(admin, "ex-1");
    expect(res).toEqual({ status: "unavailable", code: "STORAGE_REF_MISSING" });
  });

  it("unavailable STORAGE_ERROR : erreur lors de la signature", async () => {
    const admin = makeAdmin({
      exercise: coExercise({ source_id: "src-1", source_content_hash: HASH }),
      family: { id: "fam", source_id: "src-1", source_content_hash: HASH, review_status: "published" },
      source: {
        content_hash: HASH, status: "analyzed", review_status: "utilisable",
        source_kind: "audio", storage_bucket: "b", storage_path: "p",
      },
      signedUrl: { data: null, error: new Error("storage down") },
    });
    // createSignedUrl throw via error => le résolveur propage l'erreur (throw).
    await expect(resolveExerciseAudio(admin, "ex-1")).rejects.toThrow();
  });
});
