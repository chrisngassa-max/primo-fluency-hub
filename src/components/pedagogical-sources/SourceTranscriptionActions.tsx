import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AudioLines, Check, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchCurrentTranscription,
  saveTranscriptionReview,
  transcribePedagogicalSource,
  type TranscriptionSegment,
} from "@/lib/pedagogicalSourceTranscriptions";
import { getPedagogicalSourceSignedUrl, type PedagogicalSource } from "@/lib/pedagogicalSources";

const formatTime = (milliseconds: number) => new Date(milliseconds).toISOString().slice(14, 19);

export function SourceTranscriptionActions({ source }: { source: PedagogicalSource }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string>();
  const [reviewedText, setReviewedText] = useState("");
  const [segments, setSegments] = useState<TranscriptionSegment[]>([]);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["pedagogical-source-transcription", source.id],
    queryFn: () => fetchCurrentTranscription(source.id),
    enabled: open && source.source_kind === "audio",
  });

  useEffect(() => {
    if (!data) return;
    setReviewedText(data.transcription?.reviewed_text || data.transcription?.raw_text || "");
    setSegments(data.segments.map((segment) => ({ ...segment, reviewed_text: segment.reviewed_text || segment.raw_text })));
  }, [data]);
  useEffect(() => {
    if (!open || audioUrl || source.source_kind !== "audio") return;
    getPedagogicalSourceSignedUrl(source).then(setAudioUrl).catch((error) => toast.error("Lecture audio impossible", { description: error.message }));
  }, [audioUrl, open, source]);

  if (source.source_kind !== "audio") return null;
  const transcription = data?.transcription;
  const seek = (milliseconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = milliseconds / 1000;
      void audioRef.current.play();
    }
  };
  const run = async (force = false) => {
    setRunning(true);
    try {
      await transcribePedagogicalSource(source.id, force);
      await refetch();
      toast.success("Transcription prête pour relecture.");
    } catch (error: any) {
      toast.error("Transcription impossible", { description: error.message });
    } finally {
      setRunning(false);
    }
  };
  const validate = async () => {
    if (!transcription || !user) return;
    setRunning(true);
    try {
      const result = await saveTranscriptionReview(transcription.id, reviewedText, segments, user.id, source.id);
      await refetch();
      queryClient.invalidateQueries({ queryKey: ["pedagogical-source-transcription", source.id] });
      queryClient.invalidateQueries({ queryKey: ["pedagogical-sources"] });
      queryClient.invalidateQueries({ queryKey: ["pedagogical-source-chunks", source.id] });
      queryClient.invalidateQueries({ queryKey: ["differentiation-family", source.id] });
      if (result.published_family_count > 0) {
        toast.warning("Transcription validée, source à republier", {
          description: `${result.published_family_count} exercice(s) déjà publié(s) doivent être revus après cette correction.`,
        });
      } else {
        toast.success("Transcription validée par le formateur.");
      }
    } catch (error: any) {
      toast.error("Validation impossible", { description: error.message });
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      <Button size="sm" variant="outline" className="w-full gap-1.5" onClick={() => setOpen(true)}>
        <AudioLines className="h-4 w-4" /> Transcription audio
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Transcription et relecture</DialogTitle><DialogDescription>{source.title}</DialogDescription></DialogHeader>
          {audioUrl && <audio ref={audioRef} controls className="w-full" src={audioUrl} />}
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : !transcription ? (
            <Button disabled={running} onClick={() => run()}>{running && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Transcrire avec Gemini</Button>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant={transcription.status === "error" ? "destructive" : "secondary"}>{transcription.status}</Badge>
                {transcription.provider_parameters?.timestamp_status === "unverified" && (
                  <Badge variant="destructive">
                    {"Horodatage \u00e0 v\u00e9rifier"}
                    {typeof transcription.provider_parameters.timestamp_drift_ms === "number"
                      ? ` (${Math.round(transcription.provider_parameters.timestamp_drift_ms / 1000)} s d'\u00e9cart)`
                      : ""}
                  </Badge>
                )}
                {transcription.error_details && <span className="text-xs text-destructive">{String(transcription.error_details.code || "Erreur de transcription")}</span>}
                {transcription.status === "error" && <Button size="sm" variant="outline" disabled={running} onClick={() => run(true)}><RotateCcw className="mr-1 h-3 w-3" />Réessayer</Button>}
              </div>
              {transcription.status !== "error" && <>
                <Textarea value={reviewedText} onChange={(event) => setReviewedText(event.target.value)} className="min-h-28" aria-label="Texte relu" />
                <div className="space-y-2">
                  {segments.map((segment, index) => (
                    <div key={segment.id} className="rounded border p-3 space-y-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => seek(segment.start_ms)}>{formatTime(segment.start_ms)}–{formatTime(segment.end_ms)}</Button>
                        <span>{segment.speaker_label || "Locuteur non identifié"}</span><span>{segment.segment_key}</span>
                      </div>
                      <Textarea value={segment.reviewed_text || ""} onChange={(event) => setSegments((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, reviewed_text: event.target.value } : item))} />
                    </div>
                  ))}
                </div>
                {transcription.status !== "reviewed" && <Button disabled={running || segments.length === 0} onClick={validate}>{running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}Valider la relecture</Button>}
              </>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
