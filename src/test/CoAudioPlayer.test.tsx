import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockResolve, ttsCalls } = vi.hoisted(() => ({
  mockResolve: vi.fn(),
  ttsCalls: [] as Array<{ text?: string }>,
}));

vi.mock("@/lib/exerciseAudio", () => ({
  resolveExerciseAudio: (...args: unknown[]) => mockResolve(...args),
}));

vi.mock("@/components/ui/TTSAudioPlayer", () => ({
  default: (props: { text?: string }) => {
    ttsCalls.push(props);
    return <div data-testid="tts-player">{props.text}</div>;
  },
}));

import CoAudioPlayer from "@/components/eleve/CoAudioPlayer";

const SIGNED = {
  status: "resolved" as const,
  url: "https://signed.example/audio.mp3",
  expiresAt: new Date(Date.now() + 600_000).toISOString(),
};

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("CoAudioPlayer", () => {
  let container: HTMLDivElement;
  let root: Root;
  const onPlayStart = vi.fn();
  const onPlayComplete = vi.fn();

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mockResolve.mockReset();
    ttsCalls.length = 0;
    onPlayStart.mockReset();
    onPlayComplete.mockReset();
    mockResolve.mockResolvedValue(SIGNED);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function renderPlayer(props: Record<string, unknown> = {}) {
    await act(async () => {
      root.render(
        <CoAudioPlayer
          exerciseId="ex-1"
          competence="CO"
          hasOriginalAudio
          devoirId="devoir-1"
          playCount={0}
          maxPlays={2}
          onPlayStart={onPlayStart}
          onPlayComplete={onPlayComplete}
          {...props}
        />,
      );
    });
    await flush();
  }

  function audioEl() {
    return container.querySelector("audio");
  }

  it("compte la première lecture une seule fois", async () => {
    await renderPlayer();
    const audio = audioEl();
    expect(audio).toBeTruthy();
    await act(async () => {
      audio!.dispatchEvent(new Event("play"));
    });
    expect(onPlayStart).toHaveBeenCalledTimes(1);
  });

  it("ne recompte pas et ne bloque pas une pause/reprise même si le quota est atteint", async () => {
    await renderPlayer({ playCount: 0, maxPlays: 1 });
    const audio = audioEl()!;
    audio.pause = vi.fn();
    await act(async () => {
      audio.dispatchEvent(new Event("play"));
    });
    expect(onPlayStart).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.render(
        <CoAudioPlayer
          exerciseId="ex-1"
          competence="CO"
          hasOriginalAudio
          devoirId="devoir-1"
          playCount={1}
          maxPlays={1}
          onPlayStart={onPlayStart}
          onPlayComplete={onPlayComplete}
        />,
      );
    });
    await flush();
    const resumed = audioEl()!;
    resumed.pause = vi.fn();
    await act(async () => {
      resumed.dispatchEvent(new Event("play"));
    });
    expect(onPlayStart).toHaveBeenCalledTimes(1);
    expect(resumed.pause).not.toHaveBeenCalled();
  });

  it("remet l'état à ready sur ended, puis un replay consomme une nouvelle écoute", async () => {
    await renderPlayer({ playCount: 0, maxPlays: 2 });
    const audio = audioEl()!;
    await act(async () => {
      audio.dispatchEvent(new Event("play"));
    });
    expect(onPlayStart).toHaveBeenCalledTimes(1);

    await act(async () => {
      audio.dispatchEvent(new Event("ended"));
    });
    expect(onPlayComplete).toHaveBeenCalledTimes(1);

    await act(async () => {
      audio.dispatchEvent(new Event("play"));
    });
    expect(onPlayStart).toHaveBeenCalledTimes(2);
  });

  it("quota déjà atteint : pas de chargement infini, nouveau démarrage bloqué", async () => {
    await renderPlayer({ playCount: 1, maxPlays: 1 });
    expect(container.textContent).not.toContain("Préparation de l'audio");
    const audio = audioEl();
    expect(audio).toBeTruthy();
    audio!.pause = vi.fn();
    await act(async () => {
      audio!.dispatchEvent(new Event("play"));
    });
    expect(onPlayStart).not.toHaveBeenCalled();
    expect(audio!.pause).toHaveBeenCalled();
  });

  it("renouvelle l'URL sans consommer une nouvelle écoute", async () => {
    mockResolve
      .mockResolvedValueOnce(SIGNED)
      .mockResolvedValueOnce({
        ...SIGNED,
        url: "https://signed.example/audio-2.mp3",
      });
    await renderPlayer();
    const audio = audioEl()!;
    await act(async () => {
      audio.dispatchEvent(new Event("play"));
    });
    expect(onPlayStart).toHaveBeenCalledTimes(1);
    await act(async () => {
      audio.dispatchEvent(new Event("error"));
    });
    await flush();
    expect(mockResolve).toHaveBeenCalledTimes(2);
    expect(mockResolve.mock.calls[1][1]).toEqual({ forceRefresh: true });
    expect(onPlayStart).toHaveBeenCalledTimes(1);
    expect(audioEl()?.getAttribute("src")).toBe("https://signed.example/audio-2.mp3");
  });

  it("première erreur média : une résolution forcée, sans écoute supplémentaire", async () => {
    mockResolve
      .mockResolvedValueOnce(SIGNED)
      .mockResolvedValueOnce({
        ...SIGNED,
        url: "https://signed.example/audio-2.mp3",
      });
    await renderPlayer();
    expect(mockResolve.mock.calls[0][1]).toBeUndefined();
    const audio = audioEl()!;
    await act(async () => {
      audio.dispatchEvent(new Event("play"));
    });
    await act(async () => {
      audio.dispatchEvent(new Event("error"));
    });
    await flush();
    expect(mockResolve).toHaveBeenCalledTimes(2);
    expect(mockResolve.mock.calls[1][0]).toEqual(expect.objectContaining({
      exerciseId: "ex-1",
      devoirId: "devoir-1",
    }));
    expect(mockResolve.mock.calls[1][1]).toEqual({ forceRefresh: true });
    expect(onPlayStart).toHaveBeenCalledTimes(1);
    expect(audioEl()?.getAttribute("src")).toBe("https://signed.example/audio-2.mp3");
  });

  it("deuxième erreur persistante : pas de 3e appel, état unavailable", async () => {
    mockResolve
      .mockResolvedValueOnce(SIGNED)
      .mockResolvedValueOnce({
        ...SIGNED,
        url: "https://signed.example/audio-2.mp3",
      });
    await renderPlayer();
    const audio = audioEl()!;
    await act(async () => {
      audio.dispatchEvent(new Event("play"));
    });
    await act(async () => {
      audio.dispatchEvent(new Event("error"));
    });
    await flush();
    expect(mockResolve).toHaveBeenCalledTimes(2);
    expect(onPlayStart).toHaveBeenCalledTimes(1);

    const retried = audioEl()!;
    await act(async () => {
      retried.dispatchEvent(new Event("error"));
    });
    await flush();
    expect(mockResolve).toHaveBeenCalledTimes(2);
    expect(onPlayStart).toHaveBeenCalledTimes(1);
    expect(audioEl()).toBeNull();
    expect(container.textContent).toMatch(/momentanément indisponible/i);
    expect(container.querySelector("[data-testid=tts-player]")).toBeNull();
  });

  it.each([
    ["stale", "n'est plus disponible"],
    ["unavailable", "momentanément indisponible"],
    ["forbidden", "pas autorisé"],
  ] as const)("%s : message explicite, aucun TTS", async (status, snippet) => {
    mockResolve.mockResolvedValue({ status, code: status === "unavailable" ? "STORAGE_ERROR" : undefined });
    await renderPlayer({ scriptAudio: "Script historique" });
    expect(container.textContent).toMatch(new RegExp(snippet, "i"));
    expect(container.querySelector("[data-testid=tts-player]")).toBeNull();
    expect(ttsCalls).toHaveLength(0);
    expect(audioEl()).toBeNull();
  });

  it("ancien exercice sans original mais avec script autorisé : fallback TTS", async () => {
    await act(async () => {
      root.render(
        <CoAudioPlayer
          exerciseId="ex-legacy"
          competence="CO"
          scriptAudio="Bonjour, ceci est un ancien script."
          onPlayStart={onPlayStart}
        />,
      );
    });
    await flush();
    expect(mockResolve).not.toHaveBeenCalled();
    expect(container.querySelector("[data-testid=tts-player]")).toBeTruthy();
    expect(ttsCalls[0]?.text).toBe("Bonjour, ceci est un ancien script.");
  });

  it("original présent : le TTS n'est jamais appelé", async () => {
    await renderPlayer({ scriptAudio: "Ne doit pas servir" });
    expect(audioEl()).toBeTruthy();
    expect(ttsCalls).toHaveLength(0);
    expect(container.querySelector("[data-testid=tts-player]")).toBeNull();
  });
});
