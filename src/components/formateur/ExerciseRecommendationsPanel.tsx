import { useEffect, useState } from "react";
import { Check, Pencil, Send, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  ROUTER_COMPETENCES,
  type ExerciseRecommendation,
  type RouterCompetence,
} from "@/services/ExerciseRouter";

interface Props {
  recommendations: ExerciseRecommendation[];
  onUse: (recommendation: ExerciseRecommendation) => void;
}

type Decision = "pending" | "accepted" | "rejected";

const progressionLabels: Record<ExerciseRecommendation["progression"], string> = {
  remediation: "Remediation",
  consolidation: "Consolidation",
  approfondissement: "Approfondissement",
  demarrage: "Demarrage",
};

export default function ExerciseRecommendationsPanel({ recommendations, onUse }: Props) {
  const [drafts, setDrafts] = useState(recommendations);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => setDrafts(recommendations), [recommendations]);

  const updateDraft = (id: string, partial: Partial<ExerciseRecommendation>) => {
    setDrafts((current) => current.map((item) => item.id === id ? { ...item, ...partial } : item));
  };

  if (drafts.length === 0) {
    return (
      <div className="border p-4">
        <p className="text-sm font-medium">Propositions individualisees</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Aucun eleve ou resultat exploitable pour le moment.
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-3" aria-label="Propositions individualisees">
      <div>
        <h3 className="text-sm font-semibold">Propositions individualisees</h3>
        <p className="text-xs text-muted-foreground">
          Suggestions non obligatoires : le formateur garde la main sur chaque parametre.
        </p>
      </div>

      <div className="divide-y border">
        {drafts.map((recommendation) => {
          const decision = decisions[recommendation.id] ?? "pending";
          const editing = editingId === recommendation.id;
          return (
            <article key={recommendation.id} className="space-y-3 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{recommendation.eleveName}</p>
                    <Badge variant="outline">{progressionLabels[recommendation.progression]}</Badge>
                    {decision === "accepted" && <Badge className="gap-1"><Check className="h-3 w-3" /> Acceptee</Badge>}
                    {decision === "rejected" && <Badge variant="secondary">Refusee</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{recommendation.motif}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Modifier la proposition"
                    aria-label="Modifier la proposition"
                    onClick={() => setEditingId(editing ? null : recommendation.id)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Refuser la proposition"
                    aria-label="Refuser la proposition"
                    onClick={() => setDecisions((current) => ({ ...current, [recommendation.id]: "rejected" }))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {editing ? (
                <div className="grid gap-4 border-t pt-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Competence</Label>
                    <Select
                      value={recommendation.competence}
                      onValueChange={(value) => updateDraft(recommendation.id, { competence: value as RouterCompetence })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROUTER_COMPETENCES.map((competence) => (
                          <SelectItem key={competence} value={competence}>{competence}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Niveau</Label>
                    <Select
                      value={recommendation.niveau}
                      onValueChange={(value) => updateDraft(recommendation.id, {
                        niveau: value as ExerciseRecommendation["niveau"],
                      })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["A0", "A1", "A2", "B1", "B2"].map((level) => (
                          <SelectItem key={level} value={level}>{level}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`count-${recommendation.id}`}>Nombre d'exercices</Label>
                    <Input
                      id={`count-${recommendation.id}`}
                      type="number"
                      min={1}
                      max={30}
                      value={recommendation.count}
                      onChange={(event) => updateDraft(recommendation.id, {
                        count: Math.min(30, Math.max(1, Number(event.target.value) || 1)),
                      })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Difficulte : {recommendation.difficulte}/10</Label>
                    <Slider
                      value={[recommendation.difficulte]}
                      min={1}
                      max={10}
                      step={1}
                      onValueChange={([value]) => updateDraft(recommendation.id, { difficulte: value })}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="secondary">{recommendation.competence}</Badge>
                  <Badge variant="secondary">Niveau {recommendation.niveau}</Badge>
                  <Badge variant="secondary">Difficulte {recommendation.difficulte}/10</Badge>
                  <Badge variant="secondary">{recommendation.count} exercice(s)</Badge>
                  {recommendation.aides.map((aide) => <Badge key={aide} variant="outline">{aide}</Badge>)}
                </div>
              )}

              {decision !== "rejected" && (
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => setDecisions((current) => ({ ...current, [recommendation.id]: "accepted" }))}
                  >
                    <Check className="h-4 w-4" />
                    Accepter
                  </Button>
                  <Button
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                      setDecisions((current) => ({ ...current, [recommendation.id]: "accepted" }));
                      onUse(recommendation);
                    }}
                  >
                    <Send className="h-4 w-4" />
                    Preparer et envoyer
                  </Button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
