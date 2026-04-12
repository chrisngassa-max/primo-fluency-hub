import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Volume2, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface TTSAudioPlayerProps {
  text: string;
  className?: string;
  onPlayComplete?: () => void;
}

const TTSAudioPlayer = ({ text, className = "", onPlayComplete }: TTSAudioPlayerProps) => {
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const ensureAudioElement = useCallback(() => {
    if (audioRef.current) return audioRef.current;

    const audio = new Audio();
    audio.preload = "auto";
    audio.onended = () => {
      setPlaying(false);
      onPlayComplete?.();
    };
    audio.onerror = () => {
      setPlaying(false);
      toast.error("Erreur de lecture audio");
    };

    audioRef.current = audio;
    return audio;
  }, [onPlayComplete]);

  const speakWithBrowserFallback = useCallback((utterance: SpeechSynthesisUtterance | null, message?: string) => {
    if (!utterance || !("speechSynthesis" in window)) return false;

    utterance.text = message || text;
    if (!utterance.text.trim()) return false;

    utterance.lang = "fr-FR";
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.onstart = () => setPlaying(true);
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
  }, [onPlayComplete, text]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (audioRef.current) {
        audioRef.current.src = "";
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const generateAndPlay = useCallback(async () => {
    const audio = ensureAudioElement();
    const browserUtterance = typeof window !== "undefined" && "SpeechSynthesisUtterance" in window
      ? new SpeechSynthesisUtterance("")
      : null;

    if (audioUrl) {
      try {
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
        }
        audio.currentTime = 0;
        await audio.play();
        setPlaying(true);
      } catch (err: any) {
        console.error("Audio replay error:", err);
        const didFallback = speakWithBrowserFallback(browserUtterance);
        if (!didFallback) {
          toast.error("Lecture audio bloquée", {
            description: "Appuyez de nouveau sur le bouton pour relancer l'audio.",
          });
        }
      }
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("tcf-process-audio", {
        body: { action: "tts", text },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.audioBase64) throw new Error("Aucun audio retourné");

      const byteCharacters = atob(data.audioBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "audio/mpeg" });

      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }

      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      audio.src = url;
      audio.load();
      setAudioUrl(url);

      try {
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
        }
        audio.currentTime = 0;
        await audio.play();
        setPlaying(true);
      } catch (playErr: any) {
        console.error("Audio play error:", playErr);
        const didFallback = speakWithBrowserFallback(browserUtterance);
        if (!didFallback) {
          toast.error("Lecture audio bloquée", {
            description: "Le son a bien été généré. Appuyez à nouveau sur Écouter pour lancer la lecture.",
          });
        }
      }
    } catch (err: any) {
      console.error("TTS error:", err);
      const didFallback = speakWithBrowserFallback(browserUtterance);
      if (!didFallback) {
        toast.error("Impossible de générer l'audio", { description: err.message });
      }
    } finally {
      setLoading(false);
    }
  }, [audioUrl, ensureAudioElement, speakWithBrowserFallback, text]);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Button
        type="button"
        variant={playing ? "default" : "outline"}
        size="sm"
        onClick={generateAndPlay}
        disabled={loading}
        className="gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement…
          </>
        ) : playing ? (
          <>
            <Volume2 className="h-4 w-4 animate-pulse" />
            Lecture en cours…
          </>
        ) : audioUrl ? (
          <>
            <RotateCcw className="h-4 w-4" />
            Réécouter
          </>
        ) : (
          <>
            <Volume2 className="h-4 w-4" />
            Écouter
          </>
        )}
      </Button>
    </div>
  );
};

export default TTSAudioPlayer;
