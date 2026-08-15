import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ClipboardCheck, Loader2, Send, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import {
  addDifferentiationFamilyFeedback,
  fetchDifferentiationFamiliesForSource,
  fetchDifferentiationFamilyFeedback,
  generateDifferentiationFamiliesForLevels,
  getFamilyTargetLevel,
  getFamilyVariant,
  pickLatestFamilyPerLevel,
  publishDifferentiationFamily,
  SLICE_LEVELS,
  updateDifferentiationFamilyReview,
  type DifferentiationFamily,
  type LevelGenerationResult,
  type SliceLevel,
} from "@/lib/differentiationFamilies";
import type { PedagogicalSource } from "@/lib/pedagogicalSources";

function Statuses({ family }: { family: DifferentiationFamily }) {
  return (
    <div className="flex flex-wrap gap-1">
      <Badge variant="secondary">génération : {family.generation_status}</Badge>
      <Badge variant={family.validation_status === "failed" ? "destructive" : "secondary"}>
        validation : {family.validation_status}
      </Badge>
      <Badge variant={family.review_status === "rejected" ? "destructive" : "secondary"}>
        revue : {family.review_status}
      </Badge>
    </div>
  );
}

function FamilyDetails({ family }: { family: DifferentiationFamily }) {
  const level = getFamilyTargetLevel(family);
  const facts = family.payload?.facts?.required ?? [];
  const variant = getFamilyVariant(family);
  const items = variant?.exercise?.items ?? [];
  const report = family.validation_report ?? {};
  const compatibility = family.payload?.generation?.support_compatibility
    ?? family.generation_error?.support_compatibility;

  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span>Niveau : <strong>{level}</strong></span>
        <span>Questions : <strong>{items.length}</strong></span>
        <span>Publié : <strong>{family.published_exercise_id ? "oui" : "non"}</strong></span>
      </div>
      {compatibility && (
        <div className="rounded border p-3">
          <p className="font-medium">Compatibilité du support</p>
          <p className={compatibility.supported ? "text-muted-foreground" : "text-destructive"}>
            {compatibility.message}
          </p>
        </div>
      )}
      {(report.blocking?.length ?? 0) > 0 && (
        <div className="rounded border border-destructive p-3 text-destructive">
          {report.blocking!.map((entry, index) => (
            <p key={index}>{entry.code ?? "Erreur"} — {entry.message}</p>
          ))}
        </div>
      )}
      {(report.warnings?.length ?? 0) > 0 && (
        <div className="rounded border p-3">
          <p className="font-medium">Avertissements</p>
          {report.warnings!.map((entry, index) => (
            <p key={index}>{entry.code ?? "Avertissement"} — {entry.message}</p>
          ))}
        </div>
      )}
      {(report.requires_human_review?.length ?? 0) > 0 && (
        <p className="text-muted-foreground">
          À vérifier humainement : {report.requires_human_review.join(", ")}
        </p>
      )}
      <section>
        <p className="font-medium">Faits sourcés</p>
        {facts.map((fact: any) => (
          <div key={fact.fact_id} className="mt-2 rounded border p-2">
            <p>{fact.fact_id} — {fact.subject} {fact.predicate} {String(fact.object)}</p>
            <p className="text-xs text-muted-foreground">
              Segments : {(fact.provenance?.segment_refs ?? []).join(", ") || "aucun"} · Chunks : {(fact.provenance?.chunk_refs ?? []).join(", ") || "aucun"}
            </p>
          </div>
        ))}
      </section>
      <section>
        <p className="font-medium">Questions {level}</p>
        {items.map((item: any) => (
          <div key={item.id} className="mt-2 rounded border p-2">
            <p>{item.id} — {item.instruction}</p>
            <p className="text-xs text-muted-foreground">Faits : {(item.fact_refs ?? []).join(", ") || "aucun"}</p>
            {(item.choices ?? []).map((choice: any) => (
              <p key={choice.id} className="text-xs">{choice.is_correct ? "✓ " : "○ "}{choice.text}</p>
            ))}
          </div>
        ))}
      </section>
    </div>
  );
}

function LevelFamilyPanel({
  family,
  busy,
  onReview,
  onPublish,
  onFeedback,
  feedback,
  setFeedback,
  feedbackEntries,
}: {
  family: DifferentiationFamily;
  busy: boolean;
  onReview: (status: "in_review" | "validated" | "rejected") => Promise<void>;
  onPublish: () => Promise<void>;
  onFeedback: () => Promise<void>;
  feedback: string;
  setFeedback: (value: string) => void;
  feedbackEntries: Array<{ id: string; issue_type: string; comment: string }>;
}) {
  const canValidate = ["passed", "passed_with_warnings"].includes(family.validation_status);
  return (
    <div className="space-y-4">
      <Statuses family={family} />
      {family.generation_error?.message && (
        <p className="text-sm text-destructive">{family.generation_error.message}</p>
      )}
      <FamilyDetails family={family} />
      {family.published_exercise_id && (
        <p className="text-sm text-muted-foreground">Exercice publié : {family.published_exercise_id}</p>
      )}
      {feedbackEntries.length > 0 && (
        <section className="space-y-2 rounded border p-3">
          <p className="font-medium text-sm">Feedback de revue</p>
          {feedbackEntries.map((entry) => (
            <div key={entry.id} className="text-sm">
              <span className="font-medium">{entry.issue_type}</span> — {entry.comment}
            </div>
          ))}
        </section>
      )}
      <Textarea
        aria-label="Feedback sur la famille"
        placeholder="Commentaire de revue (au moins 3 caractères)"
        value={feedback}
        onChange={(event) => setFeedback(event.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={busy || feedback.trim().length < 3} onClick={onFeedback}>
          <Send className="mr-2 h-4 w-4" />Ajouter un feedback
        </Button>
        {family.review_status === "draft" && (
          <Button variant="outline" disabled={busy} onClick={() => onReview("in_review")}>
            Commencer la revue
          </Button>
        )}
        <Button
          variant="outline"
          disabled={busy || !canValidate || family.review_status === "published"}
          onClick={() => onReview("validated")}
        >
          <Check className="mr-2 h-4 w-4" />Valider
        </Button>
        <Button
          variant="outline"
          disabled={busy || family.review_status === "published"}
          onClick={() => onReview("rejected")}
        >
          Rejeter
        </Button>
        <Button disabled={busy || family.review_status !== "validated" || Boolean(family.published_exercise_id)} onClick={onPublish}>
          <Upload className="mr-2 h-4 w-4" />Publier l’exercice
        </Button>
      </div>
    </div>
  );
}

export function SourceDifferentiationFamilyActions({ source }: { source: PedagogicalSource }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [selectedLevels, setSelectedLevels] = useState<SliceLevel[]>(["A2"]);
  const [progress, setProgress] = useState<Partial<Record<SliceLevel, "pending" | "running" | "ok" | "error">>>({});
  const [lastResults, setLastResults] = useState<LevelGenerationResult[]>([]);
  const [activeTab, setActiveTab] = useState<SliceLevel>("A2");

  const { data: families = [], isLoading, refetch } = useQuery({
    queryKey: ["differentiation-families", source.id],
    queryFn: () => fetchDifferentiationFamiliesForSource(source.id),
    enabled: open && source.source_kind === "audio",
  });

  const byLevel = useMemo(() => pickLatestFamilyPerLevel(families), [families]);
  const activeFamily = byLevel[activeTab] ?? null;

  const { data: feedbackEntries = [] } = useQuery({
    queryKey: ["differentiation-family-feedback", activeFamily?.id],
    queryFn: () => fetchDifferentiationFamilyFeedback(activeFamily!.id),
    enabled: open && Boolean(activeFamily?.id),
  });

  if (source.source_kind !== "audio") return null;

  const refresh = async () => {
    await refetch();
    await queryClient.invalidateQueries({ queryKey: ["differentiation-families", source.id] });
  };

  const toggleLevel = (level: SliceLevel, checked: boolean) => {
    setSelectedLevels((current) => {
      if (checked) return SLICE_LEVELS.filter((entry) => current.includes(entry) || entry === level);
      return current.filter((entry) => entry !== level);
    });
  };

  const runSelected = async () => {
    if (selectedLevels.length === 0) {
      toast.error("Sélectionnez au moins un niveau.");
      return;
    }
    setBusy(true);
    setProgress(Object.fromEntries(selectedLevels.map((level) => [level, "running"])) as typeof progress);
    try {
      // Concurrence bornée à 1 : séquentiel contrôlé.
      const results = await generateDifferentiationFamiliesForLevels(source.id, selectedLevels, {
        concurrency: 1,
      });
      setLastResults(results);
      const nextProgress: typeof progress = {};
      for (const result of results) {
        nextProgress[result.level] = result.ok ? "ok" : "error";
        if (result.ok) {
          toast.success(`Famille ${result.level} ${result.cached ? "déjà disponible" : "générée"}.`);
          setActiveTab(result.level);
        } else if (result.error === "DIFF_TRANSFORMATION_NOT_SUPPORTED") {
          toast.warning(`Niveau ${result.level} non supporté`, {
            description: result.message || "Support insuffisant pour ce niveau.",
          });
        } else {
          toast.error(`Génération ${result.level} impossible`, {
            description: result.message || result.error,
          });
        }
      }
      setProgress(nextProgress);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const review = async (status: "in_review" | "validated" | "rejected") => {
    if (!activeFamily) return;
    setBusy(true);
    try {
      await updateDifferentiationFamilyReview(activeFamily.id, status);
      await refresh();
      toast.success(status === "validated" ? "Famille validée." : status === "rejected" ? "Famille rejetée." : "Revue ouverte.");
    } catch (error: any) {
      toast.error("Mise à jour impossible", { description: error.message });
    } finally {
      setBusy(false);
    }
  };

  const submitFeedback = async () => {
    if (!activeFamily || !user || feedback.trim().length < 3) return;
    setBusy(true);
    try {
      await addDifferentiationFamilyFeedback(activeFamily.id, user.id, feedback);
      setFeedback("");
      await queryClient.invalidateQueries({ queryKey: ["differentiation-family-feedback", activeFamily.id] });
      toast.success("Feedback enregistré.");
    } catch (error: any) {
      toast.error("Feedback impossible", { description: error.message });
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (!activeFamily) return;
    if (activeFamily.published_exercise_id) {
      toast.error("Cette famille est déjà publiée.");
      return;
    }
    setBusy(true);
    try {
      const result = await publishDifferentiationFamily(activeFamily.id);
      await refresh();
      toast.success(`Exercice ${result.niveau_vise ?? getFamilyTargetLevel(activeFamily)} publié.`, {
        description: `ID : ${result.exercise_id}`,
      });
    } catch (error: any) {
      toast.error("Publication impossible", { description: error.message });
    } finally {
      setBusy(false);
    }
  };

  const canGenerate = source.status === "analyzed";
  const availableTabs = SLICE_LEVELS.filter((level) => byLevel[level]);

  return (
    <>
      <Button size="sm" variant="outline" className="w-full gap-1.5" onClick={() => setOpen(true)}>
        <ClipboardCheck className="h-4 w-4" /> Activités CO multi-niveaux
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Activités CO à partir de la même ressource audio</DialogTitle>
            <DialogDescription>
              {source.title} — MP3, transcription et chunks restent partagés ; chaque niveau produit une famille et un exercice distincts.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 rounded border p-3">
            <p className="text-sm font-medium">Créer des activités pour :</p>
            <div className="flex flex-wrap gap-4">
              {SLICE_LEVELS.map((level) => (
                <label key={level} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={selectedLevels.includes(level)}
                    onCheckedChange={(checked) => toggleLevel(level, checked === true)}
                    disabled={busy}
                  />
                  {level}
                  {byLevel[level] && <Badge variant="secondary">existant</Badge>}
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy || !canGenerate || selectedLevels.length === 0} onClick={runSelected}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Générer les niveaux sélectionnés
              </Button>
              {!canGenerate && (
                <p className="text-xs text-muted-foreground self-center">
                  Analysez d’abord l’audio pour créer les chunks sourcés.
                </p>
              )}
            </div>
            {Object.keys(progress).length > 0 && (
              <div className="flex flex-wrap gap-2 text-xs">
                {SLICE_LEVELS.map((level) => progress[level] ? (
                  <Badge key={level} variant={progress[level] === "error" ? "destructive" : "secondary"}>
                    {level}: {progress[level]}
                  </Badge>
                ) : null)}
              </div>
            )}
            {lastResults.some((result) => !result.ok && result.error === "DIFF_TRANSFORMATION_NOT_SUPPORTED") && (
              <div className="rounded border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
                {lastResults
                  .filter((result) => !result.ok && result.error === "DIFF_TRANSFORMATION_NOT_SUPPORTED")
                  .map((result) => (
                    <p key={result.level}>
                      <strong>{result.level}</strong> — {result.message}
                    </p>
                  ))}
                <p className="text-muted-foreground mt-1">Les autres niveaux ne sont pas bloqués par ce refus.</p>
              </div>
            )}
          </div>

          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : availableTabs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune famille générée pour l’instant. Sélectionnez un ou plusieurs niveaux puis lancez la génération.
            </p>
          ) : (
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as SliceLevel)}>
              <TabsList className="flex flex-wrap h-auto">
                {availableTabs.map((level) => {
                  const family = byLevel[level]!;
                  const itemCount = getFamilyVariant(family)?.exercise?.items?.length ?? 0;
                  return (
                    <TabsTrigger key={level} value={level} className="gap-2">
                      {level}
                      <Badge variant="outline">{itemCount} Q</Badge>
                      {family.published_exercise_id && <Badge>publié</Badge>}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
              {availableTabs.map((level) => (
                <TabsContent key={level} value={level}>
                  <LevelFamilyPanel
                    family={byLevel[level]!}
                    busy={busy}
                    onReview={review}
                    onPublish={publish}
                    onFeedback={submitFeedback}
                    feedback={feedback}
                    setFeedback={setFeedback}
                    feedbackEntries={feedbackEntries}
                  />
                </TabsContent>
              ))}
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
