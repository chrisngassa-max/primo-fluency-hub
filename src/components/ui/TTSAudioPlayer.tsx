import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Volume2, Loader2, RotateCcw, Square } from "lucide-react";
import { toast } from "sonner";
import { PLAYBACK_RATES, canStartAudioPlay } from "@/lib/audioAccess";

interface TTSAudioPlayerProps {
  text: string;
  className?: string;
  label?: string;
  autoPlay?: boolean;
  size?: "sm" | "icon";
  onPlayComplete?: () => void;
  onPlayStart?: () => void;
  playCount?: number;
  maxPlays?: number | null;
  showSpeedControl?: boolean;
  language?: string;
  voiceName?: string;
  dialogueMode?: boolean;
}

type TtsSegment = {
  speaker?: string;
  text: string;
  voiceName: string;
};

const DEFAULT_VOICE = "fr-FR-Wavenet-D";
const DIALOGUE_VOICES = ["fr-FR-Wavenet-D", "fr-FR-Wavenet-B", "fr-FR-Wavenet-A", "fr-FR-Wavenet-C"];

function base64ToAudioUrl(audioBase64: string): string {
  const byteCharacters = atob(audioBase64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: "audio/mpeg" });
  return URL.createObjectURL(blob);
}

function parseDialogueSegments(rawText: string, defaultVoice: string): TtsSegment[] | null {
  const speakerVoices = new Map<string, string>();
  const segments = rawText
    .split(/\r?\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^([^:]{1,80})\s*:\s*(.+)$/);
      if (!match) return null;
      const speaker = match[1].trim();
      const spokenText = match[2].trim();
      if (!spokenText) return null;

      if (!speakerVoices.has(speaker)) {
        speakerVoices.set(speaker, DIALOGUE_VOICES[speakerVoices.size % DIALOGUE_VOICES.length] ?? defaultVoice);
      }

      return {
        speaker,
        text: spokenText,
        voiceName: speakerVoices.get(speaker) ?? defaultVoice,
      };
    })
    .filter((segment): segment is TtsSegment => Boolean(segment));

  return segments.length >= 2 ? segments : null;
}

const TTSAudioPlayer = ({
  text,
  className = "",
  label,
  autoPlay = false,
  size = "sm",
  onPlayComplete,
  onPlayStart,
  playCount = 0,
  maxPlays = null,
  showSpeedControl = false,
  language = "fr-FR",
  voiceName = DEFAULT_VOICE,
  dialogueMode = false,
}: TTSAudioPlayerProps) => {
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [dialogueUrls, setDialogueUrls] = useState<string[] | null>(null);
  const [playing, setPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlsRef = useRef<string[]>([]);
  const autoPlayTriggered = useRef(false);
  const playbackTokenRef = useRef(0);

  const dialogueSegments = dialogueMode ? parseDialogueSegments(text, voiceName) : null;

  const revokeGeneratedUrls = useCallback(() => {
    for (const url of objectUrlsRef.current) URL.revokeObjectURL(url);
    objectUrlsRef.current = [];
  }, []);

  const ensureAudioElement = useCallback(() => {
    if (audioRef.current) return audioRef.current;

    const audio = new Audio();
    audio.preload = "auto";
    audio.playbackRate = playbackRate;
    audio.onerror = () => {
      setPlaying(false);
      toast.error("Erreur de lecture audio");
    };

    audioRef.current = audio;
    return audio;
  }, [playbackRate]);

  const stopPlayback = useCallback(() => {
    playbackTokenRef.current += 1;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.onended = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setPlaying(false);
  }, []);

  const speakWithBrowserFallback = useCallback((message?: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return false;

    const utterance = new SpeechSynthesisUtterance(message || text);
    if (!utterance.text.trim()) return false;

    utterance.lang = language;
    utterance.rate = playbackRate;
    utterance.pitch = 1;
    utterance.onstart = () => {
      setPlaying(true);
      onPlayStart?.();
    };
    utterance.onend = () => {
      setPlaying(false);
      onPlayComplete?.();
    };
    utterance.onerror = () => {
      setPlaying(false);
      toast.error("Lecture audio impossible");
    };

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    return true;
  }, [language, onPlayComplete, onPlayStart, playbackRate, text]);

  const synthesizeSegment = useCallback(async (segment: TtsSegment) => {
    const { data, error } = await supabase.functions.invoke("tcf-process-audio", {
      body: { action: "tts", text: segment.text, voiceName: segment.voiceName },
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    if (!data?.audioBase64) throw new Error("Aucun audio retourne");

    const url = base64ToAudioUrl(data.audioBase64);
    objectUrlsRef.current.push(url);
    return url;
  }, []);

  const playUrls = useCallback(async (urls: string[]) => {
    if (!urls.length) return;

    const audio = ensureAudioElement();
    const token = playbackTokenRef.current + 1;
    playbackTokenRef.current = token;
    let started = false;

    for (const url of urls) {
      if (playbackTokenRef.current !== token) return;

      await new Promise<void>((resolve, reject) => {
        audio.pause();
        audio.currentTime = 0;
        audio.src = url;
        audio.playbackRate = playbackRate;
        audio.onended = () => resolve();
        audio.onerror = () => reject(new Error("Erreur de lecture audio"));

        audio.play()
          .then(() => {
            setPlaying(true);
            if (!started) {
              started = true;
              onPlayStart?.();
            }
          })
          .catch(reject);
      });
    }

    if (playbackTokenRef.current === token) {
      setPlaying(false);
      onPlayComplete?.();
    }
  }, [ensureAudioElement, onPlayComplete, onPlayStart, playbackRate]);

  useEffect(() => {
    return () => {
      stopPlayback();
      if (audioRef.current) audioRef.current.src = "";
      revokeGeneratedUrls();
    };
  }, [revokeGeneratedUrls, stopPlayback]);

  useEffect(() => {
    stopPlayback();
    revokeGeneratedUrls();
    setAudioUrl(null);
    setDialogueUrls(null);
  }, [text, voiceName, dialogueMode, revokeGeneratedUrls, stopPlayback]);

  const generateAndPlay = useCallback(async () => {
    if (!canStartAudioPlay(playCount, maxPlays)) {
      toast.info("Nombre maximal d'ecoutes atteint");
      return;
    }

    if (!language.toLowerCase().startsWith("fr")) {
      if (!speakWithBrowserFallback()) toast.error("Voix indisponible sur cet appareil");
      return;
    }

    const cachedUrls = dialogueSegments ? dialogueUrls : audioUrl ? [audioUrl] : null;
    if (cachedUrls) {
      try {
        await playUrls(cachedUrls);
      } catch (err: any) {
        console.error("Audio replay error:", err);
        toast.error("Lecture audio bloquee", { description: "Appuyez de nouveau sur le bouton pour relancer l'audio." });
      }
      return;
    }

    setLoading(true);
    try {
      let urls: string[];
      if (dialogueSegments) {
        urls = [];
        for (const segment of dialogueSegments) {
          urls.push(await synthesizeSegment(segment));
        }
        setDialogueUrls(urls);
      } else {
        const url = await synthesizeSegment({ text, voiceName });
        setAudioUrl(url);
        urls = [url];
      }

      await playUrls(urls);
    } catch (err: any) {
      console.error("TTS error:", err);
      const fallbackText = dialogueSegments?.map((segment) => segment.text).join(" ");
      const didFallback = speakWithBrowserFallback(fallbackText);
      if (!didFallback) toast.error("Impossible de generer l'audio", { description: err.message });
    } finally {
      setLoading(false);
    }
  }, [audioUrl, dialogueSegments, dialogueUrls, language, maxPlays, playCount, playUrls, speakWithBrowserFallback, synthesizeSegment, text, voiceName]);

  useEffect(() => {
    if (autoPlay && !autoPlayTriggered.current && text) {
      autoPlayTriggered.current = true;
      const timer = setTimeout(() => {
        generateAndPlay();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [autoPlay, text, generateAndPlay]);

  useEffect(() => {
    autoPlayTriggered.current = false;
  }, [text]);

  if (size === "icon") {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={(e) => {
          e.stopPropagation();
          if (playing) {
            stopPlayback();
            return;
          }
          generateAndPlay();
        }}
        disabled={loading || (!playing && !canStartAudioPlay(playCount, maxPlays))}
        className={`h-7 w-7 shrink-0 ${className}`}
        title={playing ? "Arreter" : "Ecouter"}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : playing ? (
          <Square className="h-3.5 w-3.5 fill-current text-primary" />
        ) : (
          <Volume2 className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </Button>
    );
  }

  const hasGeneratedAudio = Boolean(audioUrl || dialogueUrls);
  const defaultLabel = hasGeneratedAudio ? "Reecouter" : "Ecouter";
  const displayLabel = label || defaultLabel;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <Button
        type="button"
        variant={playing ? "default" : "outline"}
        size="sm"
        onClick={playing ? stopPlayback : generateAndPlay}
        disabled={loading || (!playing && !canStartAudioPlay(playCount, maxPlays))}
        className="gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement...
          </>
        ) : playing ? (
          <>
            <Square className="h-4 w-4 fill-current" />
            Arreter
          </>
        ) : hasGeneratedAudio ? (
          <>
            <RotateCcw className="h-4 w-4" />
            {label || "Reecouter"}
          </>
        ) : (
          <>
            <Volume2 className="h-4 w-4" />
            {displayLabel}
          </>
        )}
      </Button>
      {showSpeedControl && (
        <div className="flex items-center gap-1" aria-label="Vitesse de lecture">
          {PLAYBACK_RATES.map((rate) => (
            <Button
              key={rate}
              type="button"
              variant={playbackRate === rate ? "secondary" : "ghost"}
              size="sm"
              className="h-8 min-w-11 px-2 text-xs"
              aria-pressed={playbackRate === rate}
              onClick={() => {
                setPlaybackRate(rate);
                if (audioRef.current) audioRef.current.playbackRate = rate;
              }}
            >
              {rate}x
            </Button>
          ))}
        </div>
      )}
    </div>
  );
};

export default TTSAudioPlayer;