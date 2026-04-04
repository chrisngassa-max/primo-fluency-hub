import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Volume2, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface TTSAudioPlayerProps {
  text: string;
  className?: string;
  onPlayComplete?: () => void;
}

const MAX_PLAYS = 2;

const TTSAudioPlayer = ({ text, className = "", onPlayComplete }: TTSAudioPlayerProps) => {
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [playCount, setPlayCount] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const hasReachedLimit = playCount >= MAX_PLAYS;

  const generateAndPlay = useCallback(async () => {
    if (hasReachedLimit) return;

    // If audio already generated, just replay
    if (audioUrl && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
      setPlaying(true);
      setPlayCount((c) => c + 1);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-tts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Authorization": `Bearer ${(await supabase.auth.getSession()).data.session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ text }),
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || `Erreur ${response.status}`);
      }

      const blob = await response.blob();

      const url = URL.createObjectURL(blob);
      setAudioUrl(url);

      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        setPlaying(false);
        onPlayComplete?.();
      };
      audio.onerror = () => {
        setPlaying(false);
        toast.error("Erreur de lecture audio");
      };
      await audio.play();
      setPlaying(true);
      setPlayCount((c) => c + 1);
    } catch (err: any) {
      console.error("TTS error:", err);
      toast.error("Impossible de générer l'audio", { description: err.message });
    } finally {
      setLoading(false);
    }
  }, [text, audioUrl, hasReachedLimit]);

  const remainingPlays = MAX_PLAYS - playCount;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant={playing ? "default" : "outline"}
          size="sm"
          onClick={generateAndPlay}
          disabled={loading || hasReachedLimit}
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
          ) : hasReachedLimit ? (
            <>
              <Volume2 className="h-4 w-4 opacity-50" />
              Écoutes épuisées
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
      {!hasReachedLimit && (
        <p className="text-xs text-muted-foreground">
          {playCount === 0
            ? `Vous pouvez écouter ${MAX_PLAYS} fois`
            : `Il vous reste ${remainingPlays} écoute${remainingPlays > 1 ? "s" : ""}`}
        </p>
      )}
      {hasReachedLimit && (
        <p className="text-xs text-destructive">
          Vous avez utilisé vos {MAX_PLAYS} écoutes
        </p>
      )}
    </div>
  );
};

export default TTSAudioPlayer;
