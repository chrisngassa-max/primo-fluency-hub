import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  buildStudioFactsConfirmation,
  mergeStudioFactsConfirmation,
  type SealedFactsBundle,
  type StudioFactsConfirmation,
} from "@/lib/studioAudioWorkflow";
import { updatePedagogicalSourceFields, type PedagogicalSource } from "@/lib/pedagogicalSources";

type Props = {
  source: PedagogicalSource;
  sealed: SealedFactsBundle | null;
  confirmation: StudioFactsConfirmation | null;
  divergent: boolean;
  userId: string;
  onConfirmed: (source: PedagogicalSource) => void;
};

export function StudioAudioFactsStep({
  source,
  sealed,
  confirmation,
  divergent,
  userId,
  onConfirmed,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const alreadyOk = Boolean(
    confirmation && sealed && confirmation.facts_hash === sealed.facts_hash,
  );

  const confirm = async () => {
    if (!sealed) {
      toast.error("Aucun fait à confirmer", {
        description: "Générez d’abord le niveau A2 pour obtenir les faits communs.",
      });
      return;
    }
    if (divergent) {
      toast.error("Faits incohérents", {
        description: "Deux facts_hash différents existent. Une famille A1–B2 n’accepte qu’un seul ensemble.",
      });
      return;
    }
    if (!acknowledged && !alreadyOk) {
      toast.error("Confirmation requise", {
        description: "Cochez la case pour confirmer que les faits décrivent correctement l’audio.",
      });
      return;
    }
    setBusy(true);
    try {
      const payload = buildStudioFactsConfirmation({
        factsHash: sealed.facts_hash,
        confirmedBy: userId,
        factIds: sealed.facts.map((fact) => fact.fact_id),
      });
      const updated = await updatePedagogicalSourceFields(source.id, {
        metadata: mergeStudioFactsConfirmation(source.metadata, payload),
      });
      toast.success("Faits confirmés.", {
        description: `Empreinte enregistrée : ${sealed.facts_hash.slice(0, 18)}…`,
      });
      onConfirmed(updated);
    } catch (error: any) {
      toast.error("Enregistrement impossible", {
        description: error?.message || "Réessayez plus tard.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-4" aria-label="Vérification des faits communs">
      <div>
        <h2 className="text-lg font-semibold">Faits communs</h2>
        <p className="text-sm text-muted-foreground">
          Ces faits décrivent le contenu de l’audio. Confirmez-les avant de générer plusieurs niveaux.
          Aucune nouvelle extraction n’est lancée si un ensemble scellé existe déjà.
        </p>
      </div>

      {divergent && (
        <p className="rounded border border-destructive p-3 text-sm text-destructive" role="alert">
          Plusieurs facts_hash différents sont présents sur cette source. Corrigez ou archivez les
          familles divergentes avant de continuer.
        </p>
      )}

      {!sealed && !divergent && (
        <p className="rounded border p-3 text-sm" role="status">
          Aucun fait extrait pour l’instant. Action suivante : allez à l’étape 5, générez <strong>A2 seul</strong>,
          puis revenez ici pour confirmer les faits avant A1 / B1 / B2.
        </p>
      )}

      {sealed && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">facts_hash</span>
            <Badge variant="outline" className="font-mono text-[11px]">{sealed.facts_hash}</Badge>
            {alreadyOk && <Badge>Confirmé</Badge>}
          </div>
          <ul className="space-y-2">
            {sealed.facts.map((fact) => (
              <li key={fact.fact_id} className="rounded border p-3 text-sm">
                <p className="font-medium">{fact.fact_id}</p>
                <p>
                  {fact.subject} {fact.predicate} {String(fact.object ?? "")}
                </p>
                <p className="text-xs text-muted-foreground">
                  Segments : {(fact.provenance?.segment_refs ?? []).join(", ") || "aucun"} · Chunks :{" "}
                  {(fact.provenance?.chunk_refs ?? []).join(", ") || "aucun"}
                </p>
              </li>
            ))}
          </ul>
          {!alreadyOk && (
            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={acknowledged}
                onCheckedChange={(value) => setAcknowledged(value === true)}
                aria-label="Je confirme que ces faits décrivent correctement l’audio"
              />
              <span>Je confirme que ces faits décrivent correctement l’audio.</span>
            </label>
          )}
          <Button
            disabled={busy || divergent || (alreadyOk ? false : !acknowledged)}
            onClick={confirm}
            aria-label="Confirmer les faits communs"
          >
            {alreadyOk ? "Reconfirmer les faits" : "Confirmer les faits"}
          </Button>
        </div>
      )}
    </section>
  );
}
