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

const TTSAudioPlayer = ({ text, className = "", onPlayComplete }: TTSAudioPlayerProps) => {
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const generateAndPlay = useCallback(async () => {
    // If audio already generated, just replay
    if (audioUrl && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
      setPlaying(true);
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

      // Convert base64 to blob
      const byteCharacters = atob(data.audioBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "audio/mp3" });

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
    } catch (err: any) {
      console.error("TTS error:", err);
      toast.error("Impossible de générer l'audio", { description: err.message });
    } finally {
      setLoading(false);
    }
  }, [text, audioUrl]);

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
