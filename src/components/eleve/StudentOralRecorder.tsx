import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Mic, Square } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Props = {
  disabled?: boolean;
  onRecorded?: (blob: Blob | null) => void;
};

export default function StudentOralRecorder({ disabled = false, onRecorded }: Props) {
  const [recording, setRecording] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (!blob) {
      setPlaybackUrl(null);
      return;
    }
    const url = URL.createObjectURL(blob);
    setPlaybackUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const start = async () => {
    if (disabled) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error("L’enregistrement audio n’est pas disponible sur cet appareil.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const nextBlob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setBlob(nextBlob);
        onRecorded?.(nextBlob);
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };
      recorder.start();
      setRecording(true);
    } catch {
      toast.error("Autorisez le microphone pour enregistrer votre réponse.");
    }
  };

  const stop = () => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    setRecording(false);
  };

  return (
    <div className="space-y-3 rounded-lg border border-orange-200 bg-orange-50/60 p-4">
      <p className="text-sm font-medium">Réponse orale</p>
      <p className="text-xs text-muted-foreground">
        Enregistrez votre réponse, puis réécoutez-la avant de l’envoyer.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {recording ? (
          <Button type="button" variant="destructive" onClick={stop} className="gap-2">
            <Square className="h-4 w-4" /> Arrêter l’enregistrement
          </Button>
        ) : (
          <Button type="button" variant="outline" onClick={start} disabled={disabled} className="gap-2">
            <Mic className="h-4 w-4" /> {blob ? "Réenregistrer" : "Enregistrer ma réponse"}
          </Button>
        )}
        {blob && !recording && (
          <Badge variant="secondary" className="gap-1">
            <CheckCircle2 className="h-3 w-3" /> Audio enregistré
          </Badge>
        )}
      </div>
      {playbackUrl && <audio controls src={playbackUrl} className="w-full" />}
    </div>
  );
}
