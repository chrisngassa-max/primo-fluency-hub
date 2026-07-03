import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, Volume2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { emitLiveEvent } from "@/lib/liveEventEmitter";
import { RandomClickDetector } from "@/lib/randomClickDetector";

export interface PreviewExercise {
  titre?: string;
  consigne?: string;
  competence?: string;
  format?: string;
  niveau_vise?: string;
  created_at?: string;
  contenu?: Record<string, unknown> | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exercise: PreviewExercise | null;
  interactive?: boolean;
  onTestComplete?: () => void;
  /** Contexte séance live — émission clic_aleatoire_probable si fourni */
  sessionId?: string | null;
  eleveId?: string | null;
}

function getContenu(exercise: PreviewExercise) {
  if (typeof exercise.contenu === "object" && exercise.contenu !== null) {
    return exercise.contenu;
  }
  return { items: [] };
}

export function formatExerciseDate(date?: string) {
  if (!date) return null;
  return format(new Date(date), "d MMM yyyy, HH:mm", { locale: fr });
}

export default function ExerciseStudentPreviewDialog({
  open,
  onOpenChange,
  exercise,
  interactive = false,
  onTestComplete,
  sessionId,
  eleveId,
}: Props) {
  const [page, setPage] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const randomClickRef = useRef(new RandomClickDetector());

  useEffect(() => {
    if (open) {
      setPage(0);
      setAnswers({});
      randomClickRef.current.reset();
    }
  }, [open, exercise]);

  const pc = useMemo(() => (exercise ? getContenu(exercise) : { items: [] }), [exercise]);
  const items: unknown[] = Array.isArray((pc as { items?: unknown[] }).items)
    ? (pc as { items: unknown[] }).items
    : [];
  const totalPages = items.length;
  const currentItem = items[page] as Record<string, unknown> | undefined;

  const handleAnswerChange = (value: string) => {
    setAnswers((current) => ({ ...current, [String(page)]: value }));
    if (!interactive || !sessionId || !eleveId || !currentItem) return;
    const options = currentItem.options as string[] | undefined;
    if (!Array.isArray(options)) return;
    const isCorrect = value === String(currentItem.bonne_reponse ?? "");
    if (!randomClickRef.current.record(page, isCorrect)) return;
    void emitLiveEvent({
      sessionId,
      eleveId,
      eventType: "clic_aleatoire_probable",
      payload: {
        exercice_id: exercise?.titre,
        item_indices: [page - 2, page - 1, page].filter((n) => n >= 0),
        pattern: "3_reponses_rapides_score_faible",
        source: "preview_dialog",
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            {interactive ? "Test élève" : "Aperçu Élève"} — {exercise?.titre}
          </DialogTitle>
          <DialogDescription>
            {interactive
              ? "Parcourez l'exercice comme un élève avant de le valider."
              : "Voici l'exercice tel que l'élève le verra sur son espace."}
          </DialogDescription>
        </DialogHeader>

        {exercise && (
          <div className="space-y-5 pt-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Consigne</CardTitle>
                <CardDescription>{exercise.consigne}</CardDescription>
              </CardHeader>
            </Card>

            {(() => {
              const imgUrl =
                (pc as { image_url?: string }).image_url ||
                (pc as { image?: string }).image ||
                (pc as { visual?: string }).visual ||
                (pc as { support_visuel?: string }).support_visuel;
              return imgUrl && typeof imgUrl === "string" && imgUrl.startsWith("http") ? (
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="pb-4 pt-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
                      Document visuel
                    </p>
                    <img src={imgUrl} alt="Support visuel" className="mx-auto max-w-full rounded-lg" />
                  </CardContent>
                </Card>
              ) : null;
            })()}

            {exercise.competence === "CE" && (pc as { texte?: string }).texte && (
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="pb-4 pt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
                    Document à lire
                  </p>
                  <p className="whitespace-pre-wrap text-sm">{(pc as { texte: string }).texte}</p>
                </CardContent>
              </Card>
            )}

            <div className="flex flex-wrap gap-2">
              <Badge>{exercise.competence}</Badge>
              <Badge variant="outline">{exercise.format?.replace(/_/g, " ")}</Badge>
              <Badge variant="secondary">Niveau {exercise.niveau_vise}</Badge>
            </div>

            {totalPages > 0 ? (
              <>
                <div className="flex items-center justify-between">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="gap-1">
                    <ChevronLeft className="h-4 w-4" />
                    Précédent
                  </Button>
                  <span className="text-sm font-medium text-muted-foreground">
                    Question {page + 1} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage((p) => p + 1)}
                    className="gap-1"
                  >
                    Suivant
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                {currentItem && (
                  <Card>
                    <CardContent className="space-y-3 pt-4">
                      <p className="text-sm font-medium">
                        <span className="mr-2 font-bold text-primary">Q{page + 1}.</span>
                        {String(currentItem.question ?? currentItem.consigne ?? currentItem.texte ?? "")}
                      </p>
                      {exercise.competence === "CO" && (
                        <Button variant="outline" size="sm" className="gap-2" disabled={!interactive}>
                          <Volume2 className="h-4 w-4" />
                          Écouter l'audio
                        </Button>
                      )}
                      {Array.isArray(currentItem.options) && currentItem.options.length > 0 ? (
                        <RadioGroup
                          disabled={!interactive}
                          value={answers[String(page)] ?? ""}
                          onValueChange={handleAnswerChange}
                          className="space-y-1"
                        >
                          {(currentItem.options as string[]).map((opt, oi) => {
                            const id = `preview-q${page}-o${oi}`;
                            return (
                              <div key={id} className="flex items-center space-x-2 rounded-lg border bg-muted/30 p-2">
                                <RadioGroupItem value={opt} id={id} />
                                <Label htmlFor={id} className={cn("flex-1 text-sm", interactive && "cursor-pointer")}>
                                  {opt}
                                </Label>
                              </div>
                            );
                          })}
                        </RadioGroup>
                      ) : (
                        <div className="rounded-md border bg-muted/20 p-3 text-sm italic text-muted-foreground">
                          Zone de saisie libre pour l'élève
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                <div className="flex justify-center gap-1">
                  {items.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setPage(i)}
                      className={cn(
                        "h-2.5 w-2.5 rounded-full transition-colors",
                        i === page ? "bg-primary" : "bg-muted-foreground/30 hover:bg-muted-foreground/50",
                      )}
                    />
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune question dans cet exercice.</p>
            )}

            {interactive && onTestComplete && (
              <div className="flex justify-end border-t pt-4">
                <Button
                  onClick={() => {
                    onTestComplete();
                    onOpenChange(false);
                  }}
                >
                  Test terminé — revenir à la validation
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
