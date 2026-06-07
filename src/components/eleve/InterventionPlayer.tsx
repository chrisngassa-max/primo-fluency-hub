import { useEffect, useRef, useState } from "react";
import { Headphones, Play, Pause, ArrowUp } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useInterventionListener } from "@/hooks/useInterventionListener";
import { useNavigate } from "react-router-dom";

type Props = {
  sessionId: string | null | undefined;
};

export default function InterventionPlayer({ sessionId }: Props) {
  const navigate = useNavigate();
  const { intervention, dismiss } = useInterventionListener(sessionId);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  // Lecture auto 1s après ouverture
  useEffect(() => {
    if (!intervention?.audio_url) return;
    const t = setTimeout(() => {
      audioRef.current?.play().catch(() => {
        /* iOS autoplay bloqué — l'utilisateur cliquera sur Écouter */
      });
    }, 1000);
    return () => clearTimeout(t);
  }, [intervention?.id, intervention?.audio_url]);

  if (!intervention) return null;

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) el.play();
    else el.pause();
  };

  return (
    <Dialog open={!!intervention} onOpenChange={(open) => { if (!open) dismiss(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            {intervention.isRecalibrage ? <ArrowUp className="h-5 w-5 text-emerald-600" /> : <Headphones className="h-5 w-5 text-primary" />}
            {intervention.isRecalibrage ? "Progression !" : "Conseil personnalisé"}
          </DialogTitle>
          <DialogDescription className="font-semibold text-foreground">
            {intervention.titre}
          </DialogDescription>
        </DialogHeader>

        <div className={`rounded-md border p-4 text-base leading-relaxed ${intervention.isRecalibrage ? 'bg-emerald-50/50 border-emerald-100 text-emerald-900' : 'bg-muted/30'}`}>
          {intervention.contenu_texte}
        </div>

        {!intervention.isRecalibrage && (
          intervention.audio_url ? (
            <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Button onClick={togglePlay} variant="secondary" size="sm" className="gap-2">
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {playing ? "Pause" : "Écouter"}
              </Button>
              <Progress value={progress} className="h-2 flex-1" />
            </div>
            <audio
              ref={audioRef}
              src={intervention.audio_url}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => { setPlaying(false); setProgress(100); }}
              onTimeUpdate={(e) => {
                const a = e.currentTarget;
                if (a.duration) setProgress((a.currentTime / a.duration) * 100);
              }}
              className="hidden"
            />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Lecture audio indisponible — texte uniquement.</p>
        ))}

        <div className="flex flex-wrap gap-2 text-xs">
          {intervention.competence && (
            <Badge variant="outline">Compétence : {intervention.competence}</Badge>
          )}
          {intervention.niveau_cible && (
            <Badge variant="outline">Niveau : {intervention.niveau_cible}</Badge>
          )}
        </div>

        <DialogFooter>
          {intervention.isExercicePersonnalise ? (
            <Button
              onClick={async () => {
                await dismiss();
                navigate(`/eleve/exercices-seance/${sessionId}`);
              }}
              className="w-full"
            >
              Faire l'exercice
            </Button>
          ) : (
            <Button onClick={dismiss} className="w-full">OK, j'ai compris</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
