import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ClipboardCheck, Loader2, Send, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import {
  addDifferentiationFamilyFeedback,
  fetchLatestDifferentiationFamily,
  generateDifferentiationFamily,
  publishDifferentiationFamily,
  updateDifferentiationFamilyReview,
  type DifferentiationFamily,
} from "@/lib/differentiationFamilies";
import type { PedagogicalSource } from "@/lib/pedagogicalSources";

function Statuses({ family }: { family: DifferentiationFamily }) {
  return <div className="flex flex-wrap gap-1">
    <Badge variant="secondary">génération : {family.generation_status}</Badge>
    <Badge variant={family.validation_status === "failed" ? "destructive" : "secondary"}>validation : {family.validation_status}</Badge>
    <Badge variant={family.review_status === "rejected" ? "destructive" : "secondary"}>revue : {family.review_status}</Badge>
  </div>;
}

function FamilyDetails({ family }: { family: DifferentiationFamily }) {
  const facts = family.payload?.facts?.required ?? [];
  const items = family.payload?.variants?.A2?.exercise?.items ?? [];
  const report = family.validation_report ?? {};
  return <div className="space-y-3 text-sm">
    {(report.blocking?.length ?? 0) > 0 && <div className="rounded border border-destructive p-3 text-destructive">
      {report.blocking!.map((entry, index) => <p key={index}>{entry.code ?? "Erreur"} — {entry.message}</p>)}
    </div>}
    {(report.warnings?.length ?? 0) > 0 && <div className="rounded border p-3">
      <p className="font-medium">Avertissements</p>
      {report.warnings!.map((entry, index) => <p key={index}>{entry.code ?? "Avertissement"} — {entry.message}</p>)}
    </div>}
    {(report.requires_human_review?.length ?? 0) > 0 && <p className="text-muted-foreground">À vérifier humainement : {report.requires_human_review.join(", ")}</p>}
    <section><p className="font-medium">Faits sourcés</p>{facts.map((fact: any) => <div key={fact.fact_id} className="mt-2 rounded border p-2">
      <p>{fact.fact_id} — {fact.subject} {fact.predicate} {String(fact.object)}</p>
      <p className="text-xs text-muted-foreground">Segments : {(fact.provenance?.segment_refs ?? []).join(", ") || "aucun"} · Chunks : {(fact.provenance?.chunk_refs ?? []).join(", ") || "aucun"}</p>
    </div>)}</section>
    <section><p className="font-medium">Questions A2</p>{items.map((item: any) => <div key={item.id} className="mt-2 rounded border p-2">
      <p>{item.id} — {item.instruction}</p>
      <p className="text-xs text-muted-foreground">Faits : {(item.fact_refs ?? []).join(", ") || "aucun"}</p>
      {(item.choices ?? []).map((choice: any) => <p key={choice.id} className="text-xs">{choice.is_correct ? "✓ " : "○ "}{choice.text}</p>)}
    </div>)}</section>
  </div>;
}

export function SourceDifferentiationFamilyActions({ source }: { source: PedagogicalSource }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const { data: family, isLoading, refetch } = useQuery({
    queryKey: ["differentiation-family", source.id],
    queryFn: () => fetchLatestDifferentiationFamily(source.id),
    enabled: open && source.source_kind === "audio",
  });
  if (source.source_kind !== "audio") return null;

  const refresh = async () => {
    await refetch();
    await queryClient.invalidateQueries({ queryKey: ["differentiation-family", source.id] });
  };
  const run = async () => {
    setBusy(true);
    try {
      await generateDifferentiationFamily(source.id);
      await refresh();
      toast.success("Famille A2 générée.");
    } catch (error: any) {
      toast.error("Génération A2 impossible", { description: error.message });
    } finally { setBusy(false); }
  };
  const review = async (status: "in_review" | "validated" | "rejected") => {
    if (!family) return;
    setBusy(true);
    try {
      await updateDifferentiationFamilyReview(family.id, status);
      await refresh();
      toast.success(status === "validated" ? "Famille validée." : status === "rejected" ? "Famille rejetée." : "Revue ouverte.");
    } catch (error: any) {
      toast.error("Mise à jour impossible", { description: error.message });
    } finally { setBusy(false); }
  };
  const submitFeedback = async () => {
    if (!family || !user || feedback.trim().length < 3) return;
    setBusy(true);
    try {
      await addDifferentiationFamilyFeedback(family.id, user.id, feedback);
      setFeedback("");
      toast.success("Feedback enregistré.");
    } catch (error: any) {
      toast.error("Feedback impossible", { description: error.message });
    } finally { setBusy(false); }
  };
  const publish = async () => {
    if (!family) return;
    setBusy(true);
    try {
      const result = await publishDifferentiationFamily(family.id);
      await refresh();
      toast.success("Exercice publié.", { description: `ID : ${result.exercise_id}` });
    } catch (error: any) {
      toast.error("Publication impossible", { description: error.message });
    } finally { setBusy(false); }
  };

  const canValidate = family && ["passed", "passed_with_warnings"].includes(family.validation_status);
  return <>
    <Button size="sm" variant="outline" className="w-full gap-1.5" onClick={() => setOpen(true)}>
      <ClipboardCheck className="h-4 w-4" /> Famille A2
    </Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Revue de la famille A2</DialogTitle><DialogDescription>{source.title}</DialogDescription></DialogHeader>
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : !family ? (
          <div className="space-y-3"><p className="text-sm text-muted-foreground">La transcription doit être relue et l’audio analysé avant la génération.</p><Button disabled={busy} onClick={run}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Générer la famille A2</Button></div>
        ) : <div className="space-y-4">
          <Statuses family={family} />
          {family.generation_error?.message && <p className="text-sm text-destructive">{family.generation_error.message}</p>}
          <FamilyDetails family={family} />
          <Textarea aria-label="Feedback sur la famille" placeholder="Commentaire de revue (au moins 3 caractères)" value={feedback} onChange={(event) => setFeedback(event.target.value)} />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={busy || feedback.trim().length < 3} onClick={submitFeedback}><Send className="mr-2 h-4 w-4" />Ajouter un feedback</Button>
            {family.review_status === "draft" && <Button variant="outline" disabled={busy} onClick={() => review("in_review")}>Commencer la revue</Button>}
            <Button variant="outline" disabled={busy || !canValidate || family.review_status === "published"} onClick={() => review("validated")}><Check className="mr-2 h-4 w-4" />Valider</Button>
            <Button variant="outline" disabled={busy || family.review_status === "published"} onClick={() => review("rejected")}>Rejeter</Button>
            <Button disabled={busy || family.review_status !== "validated"} onClick={publish}><Upload className="mr-2 h-4 w-4" />Publier l’exercice</Button>
          </div>
        </div>}
      </DialogContent>
    </Dialog>
  </>;
}
