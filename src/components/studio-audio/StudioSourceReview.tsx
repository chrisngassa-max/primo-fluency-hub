import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import type { PedagogicalSource } from "@/lib/pedagogicalSources";
import type { TranscriptionStatus } from "@/lib/pedagogicalSourceTranscriptions";
import { markSourceUsable, sourceReviewBlock, sourceReviewError } from "@/lib/sourceUsabilityReview";

export function StudioSourceReview({ source, transcriptionStatus, userId, role, onSaved }: {
  source: PedagogicalSource; transcriptionStatus: TranscriptionStatus | null | undefined;
  userId: string | undefined; role: string | null; onSaved: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const block = sourceReviewBlock(source, transcriptionStatus, userId, role);
  const usable = source.review_status === "utilisable";
  const confirm = async () => {
    if (busy || block) return;
    setBusy(true); setError("");
    try {
      await markSourceUsable(source);
      setSaved(true); setOpen(false);
      await onSaved();
    } catch (cause) { setError(sourceReviewError(cause)); }
    finally { setBusy(false); }
  };
  return <section className="space-y-3 rounded border p-4" aria-label="Revue de la source">
    <h2 className="text-lg font-semibold">Revue de la source</h2>
    <dl className="grid gap-1 text-sm">
      <div><dt className="inline font-medium">Droits : </dt><dd className="inline">{source.rights_status === "internal_pilot" ? "Pilote interne" : source.rights_status || "Non renseignés"}</dd></div>
      <div><dt className="inline font-medium">Transcription : </dt><dd className="inline">{transcriptionStatus === "reviewed" ? "Revue / corrigée" : transcriptionStatus ? "Brouillon (non revue)" : "Absente"}</dd></div>
      <div><dt className="inline font-medium">Analyse : </dt><dd className="inline">{source.status === "analyzed" ? "Terminée" : "Absente ou non terminée"}</dd></div>
      <div><dt className="inline font-medium">Revue de la source : </dt><dd className="inline">{source.review_status}</dd></div>
    </dl>
    {(usable || saved) && <p role="status">Source utilisable. Aucun exercice n’a été publié par cette action.</p>}
    {source.review_status === "brouillon" && <>
      {block && <p className="text-sm">{sourceReviewError(new Error(block))}</p>}
      {!block && <Button disabled={busy || saved} onClick={() => { setError(""); setOpen(true); }}>Marquer la source comme utilisable</Button>}
    </>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <AlertDialog open={open} onOpenChange={(next) => { if (!busy) setOpen(next); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmer la revue de la source</AlertDialogTitle>
          <AlertDialogDescription>Je confirme que la transcription a été relue, que les informations principales ont été vérifiées et que les droits d’utilisation sont renseignés. Le statut utilisable autorisera la génération. Cela ne publie aucun exercice.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Annuler</AlertDialogCancel>
          <AlertDialogAction disabled={busy || Boolean(block)} onClick={(event) => { event.preventDefault(); void confirm(); }}>Confirmer : source utilisable</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>;
}
