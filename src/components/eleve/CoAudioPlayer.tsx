import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Volume2 } from "lucide-react";
import TTSAudioPlayer from "@/components/ui/TTSAudioPlayer";
import { canStartAudioPlay, remainingAudioPlays } from "@/lib/audioAccess";
import { resolveExerciseAudio, type AudioResolution } from "@/lib/exerciseAudio";

/**
 * Lecteur audio CO partagé.
 *
 * Politique d'affichage :
 *  - Un audio original est déclaré (`hasOriginalAudio` OU un contexte de
 *    résolution fourni) → on résout le MP3 original côté serveur.
 *      • resolved   → <audio> natif. AUCUN TTS.
 *      • stale      → message d'erreur explicite. AUCUN TTS.
 *      • unavailable/forbidden → message d'erreur. AUCUN TTS.
 *  - Aucun original + `scriptAudio` fourni (devoirs/play/preview) → fallback TTS.
 *  - Aucun original + pas de script → message « audio indisponible ».
 *
 * Compteur d'écoutes : machine à états `PRÊT → LECTURE_COMPTÉE → (pause/reprise
 * sans recomptage) → ended → PRÊT`. Le renouvellement d'URL (expiration)
 * conserve l'état et la position. Une écoute n'est comptée qu'au démarrage
 * effectif du média, jamais lors de la résolution.
 */

interface CoAudioPlayerProps {
  exerciseId: string;
  competence: string;
  /** Vrai si un audio original résolvable existe (séance sanitisée). */
  hasOriginalAudio?: boolean;
  /** Fallback TTS, uniquement pour les parcours où script_audio était déjà
   *  légitimement délivré (devoirs/play/preview). Ne PAS transmettre en
   *  séance live. */
  scriptAudio?: string;
  /** Gate d'écoutes (préserver DevoirPassation). */
  playCount?: number;
  maxPlays?: number | null;
  onPlayStart?: () => void;
  onPlayComplete?: () => void;
  /** Contexte d'autorisation (exactement un). */
  sessionCode?: string;
  devoirId?: string;
  playToken?: string;
  preview?: boolean;
  label?: string;
  showSpeedControl?: boolean;
  className?: string;
}

type ResolutionState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "resolved"; url: string; expiresAt: string }
  | { kind: "no_original_audio" }
  | { kind: "stale" }
  | { kind: "unavailable" }
  | { kind: "forbidden" };

type ListenState = "ready" | "counted";

const ERROR_MESSAGES = {
  stale: "L'audio original n'est plus disponible : la source a été modifiée. Il sera remplacé après republication.",
  unavailable: "L'audio original est momentanément indisponible. Réessaie dans un instant.",
  forbidden: "Tu n'es pas autorisé(e) à écouter cet audio.",
  none: "Audio original indisponible pour cet ancien exercice.",
} as const;

export default function CoAudioPlayer({
  exerciseId,
  competence,
  hasOriginalAudio,
  scriptAudio,
  playCount = 0,
  maxPlays = null,
  onPlayStart,
  onPlayComplete,
  sessionCode,
  devoirId,
  playToken,
  preview,
  label = "Écoute audio",
  showSpeedControl,
  className,
}: CoAudioPlayerProps) {
  const isCO = (competence ?? "").toUpperCase() === "CO";
  const wantOriginal = isCO && (hasOriginalAudio || Boolean(sessionCode || devoirId || playToken || preview));

  const [resolution, setResolution] = useState<ResolutionState>({ kind: "idle" });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const listenStateRef = useRef<ListenState>("ready");
  // Position conservée lors d'un renouvellement d'URL.
  const savedTimeRef = useRef<number>(0);
  const isReloadingRef = useRef<boolean>(false);
  const autoRetryCountRef = useRef(0);
  const MAX_AUTO_RETRIES = 1;
  const [isReloading, setIsReloading] = useState(false);

  const remaining = useMemo(
    () => remainingAudioPlays(playCount, maxPlays),
    [playCount, maxPlays],
  );

  const resolveNow = useCallback(async (forceRefresh = false) => {
    // La résolution d'URL ne consomme aucune écoute : le quota s'applique
    // uniquement au démarrage effectif d'une nouvelle écoute (état ready).
    setResolution({ kind: "loading" });
    const result: AudioResolution = await resolveExerciseAudio(
      {
        exerciseId,
        sessionCode,
        devoirId,
        playToken,
        preview,
      },
      forceRefresh ? { forceRefresh: true } : undefined,
    );
    switch (result.status) {
      case "resolved":
        setResolution({ kind: "resolved", url: result.url, expiresAt: result.expiresAt });
        break;
      case "no_original_audio":
        setResolution({ kind: "no_original_audio" });
        break;
      case "stale":
        setResolution({ kind: "stale" });
        break;
      case "unavailable":
        setResolution({ kind: "unavailable" });
        break;
      case "forbidden":
        setResolution({ kind: "forbidden" });
        break;
    }
  }, [exerciseId, sessionCode, devoirId, playToken, preview]);

  // Démarre la résolution dès le montage si un original est attendu.
  useEffect(() => {
    if (wantOriginal && resolution.kind === "idle") {
      void resolveNow();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantOriginal]);

  // Nouveau contexte / exercice : on autorise à nouveau une tentative auto.
  // On ne remet PAS le compteur à zéro à la simple réception d'une URL.
  useEffect(() => {
    autoRetryCountRef.current = 0;
  }, [exerciseId, sessionCode, devoirId, playToken, preview]);

  // --- Machine à états d'écoutes ----------------------------------------
  // PRÊT ──play──▶ LECTURE_COMPTÉE ──pause/reprise──▶ (reste LECTURE_COMPTÉE)
  // ──ended──▶ PRÊT. Le quota ne bloque qu'une NOUVELLE écoute (ready).
  const handlePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (
      listenStateRef.current === "ready"
      && !canStartAudioPlay(playCount, maxPlays)
    ) {
      audio.pause();
      return;
    }
    if (listenStateRef.current === "ready") {
      listenStateRef.current = "counted";
      onPlayStart?.();
    }
    // Lecture effective réussie : un futur cycle d'écoute peut retenter une fois.
    autoRetryCountRef.current = 0;
  }, [onPlayStart, playCount, maxPlays]);

  const handleEnded = useCallback(() => {
    // Retour à PRÊT : une nouvelle écoute sera comptée au prochain play.
    listenStateRef.current = "ready";
    onPlayComplete?.();
  }, [onPlayComplete]);

  // Renouvellement forcé : ignore le cache contextuel, conserve état et position.
  const reloadUrl = useCallback(async () => {
    const audio = audioRef.current;
    if (audio) savedTimeRef.current = audio.currentTime;
    isReloadingRef.current = true;
    setIsReloading(true);
    await resolveNow(true);
    // La position est restaurée dans l'effet ci-dessous.
  }, [resolveNow]);

  const handleMediaError = useCallback(() => {
    if (isReloadingRef.current) return;
    if (autoRetryCountRef.current < MAX_AUTO_RETRIES) {
      autoRetryCountRef.current += 1;
      void reloadUrl();
      return;
    }
    setIsReloading(false);
    setResolution({ kind: "unavailable" });
  }, [reloadUrl]);

  // Quand une URL résolue arrive (ou est renouvelée), restaurer la position si
  // on était en train de relire l'audio.
  useEffect(() => {
    if (resolution.kind !== "resolved") return;
    const audio = audioRef.current;
    if (audio && isReloadingRef.current) {
      const t = savedTimeRef.current;
      // Laisse le nouveau src se charger puis restaure la position. L'état
      // d'écoute est conservé : aucune écoute supplémentaire n'est comptée.
      const restore = () => {
        try { audio.currentTime = t; } catch { /* ignore */ }
        audio.removeEventListener("loadedmetadata", restore);
      };
      audio.addEventListener("loadedmetadata", restore);
      isReloadingRef.current = false;
      setIsReloading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolution]);

  if (!isCO) return null;

  // --- Cas : audio original attendu -------------------------------------
  if (wantOriginal) {
    if (resolution.kind === "loading" || resolution.kind === "idle") {
      return (
        <div className={className}>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Préparation de l'audio…</span>
          </div>
        </div>
      );
    }
    if (resolution.kind === "resolved") {
      return (
        <div className={className}>
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
            <p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-primary">
              <Volume2 className="h-3.5 w-3.5" /> {label}
            </p>
            <audio
              ref={audioRef}
              src={resolution.url}
              controls
              className="w-full"
              onPlay={handlePlay}
              onEnded={handleEnded}
              onError={handleMediaError}
            />
            {remaining !== null && (
              <p className="mt-1 text-xs text-muted-foreground">
                {remaining > 0
                  ? `${remaining} écoute${remaining > 1 ? "s" : ""} restante${remaining > 1 ? "s" : ""}`
                  : "Nombre maximal d'écoutes atteint."}
              </p>
            )}
          </div>
        </div>
      );
    }
    if (resolution.kind === "stale" || resolution.kind === "unavailable" || resolution.kind === "forbidden") {
      const msg = resolution.kind === "stale"
        ? ERROR_MESSAGES.stale
        : resolution.kind === "forbidden"
          ? ERROR_MESSAGES.forbidden
          : ERROR_MESSAGES.unavailable;
      return (
        <div className={className}>
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            {msg}
          </div>
        </div>
      );
    }
    // no_original_audio : aucun original déclaré mais le résolveur confirme
    // l'absence. Fallback TTS uniquement si un script légitime est fourni
    // (devoirs/play/preview). En séance live, on affiche le message explicite.
    if (scriptAudio && scriptAudio.trim()) {
      return (
        <div className={className}>
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
            <p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-primary">
              <Volume2 className="h-3.5 w-3.5" /> {label}
            </p>
            <TTSAudioPlayer
              text={scriptAudio}
              showSpeedControl={showSpeedControl}
              playCount={playCount}
              maxPlays={maxPlays}
              onPlayStart={onPlayStart}
              onPlayComplete={onPlayComplete}
            />
          </div>
        </div>
      );
    }
    return (
      <div className={className}>
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          {ERROR_MESSAGES.none}
        </div>
      </div>
    );
  }

  // --- Cas : aucun original attendu (fallback TTS pour devoirs/play/preview)
  if (scriptAudio && scriptAudio.trim()) {
    return (
      <div className={className}>
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
          <p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-primary">
            <Volume2 className="h-3.5 w-3.5" /> {label}
          </p>
          <TTSAudioPlayer
            text={scriptAudio}
            showSpeedControl={showSpeedControl}
            playCount={playCount}
            maxPlays={maxPlays}
            onPlayStart={onPlayStart}
            onPlayComplete={onPlayComplete}
          />
        </div>
      </div>
    );
  }

  // Aucun original, aucun script : indisponible.
  return (
    <div className={className}>
      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        {ERROR_MESSAGES.none}
      </div>
    </div>
  );
}
