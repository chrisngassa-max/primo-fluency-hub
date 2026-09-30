import { useEffect, useState } from "react";
import type { DifferentiationFamily } from "@/lib/differentiationFamilies";
import { reviseStudioFacts, type FactEdit, type FactsRevisionReceipt } from "@/lib/studioFactsRevision";
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
  family?: DifferentiationFamily;
  onRevised?: () => Promise<void>;
};

export function StudioAudioFactsStep({
  source,
  sealed,
  confirmation,
  divergent,
  userId,
  onConfirmed,
  family,
  onRevised,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [edits, setEdits] = useState<FactEdit[] | null>(null);
  const [editBase, setEditBase] = useState<{hash:string;version:number;updatedAt:string} | null>(null);
  const [message, setMessage] = useState('');
  const [failure, setFailure] = useState('');
  const [saved, setSaved] = useState<FactsRevisionReceipt | null>(null);
  const refreshPending = !!saved && (sealed?.facts_hash !== saved.new_hash || family?.payload?.version !== saved.version);
  useEffect(() => { setAcknowledged(false); }, [sealed?.facts_hash, family?.payload?.version]);
  const items = family?.payload?.variants?.A2?.exercise?.items ?? [];
  const references = (id:string) => items.filter((item:any) => item.fact_refs?.includes(id));
  const supporting = (id:string) => (sealed?.facts ?? []).filter((fact:any) =>
    (fact.semantic_qualifiers?.support_fact_ids ?? []).includes(id) || (fact.semantic_qualifiers?.supporting_fact_refs ?? []).includes(id));
  const canEdit = !!family && family.review_status==='draft' && family.generation_status==='generated'
    && !family.published_exercise_id && sealed?.sourceFamilyId===family.id && sealed.levels.every(level=>level==='A2') && !divergent;
  const beginEditing = () => {
    if (!sealed || !family) return;
    setEditBase({hash:sealed.facts_hash,version:family.payload.version,updatedAt:source.updated_at});
    setAcknowledged(false);setFailure('');setMessage('');
    setEdits((sealed?.facts ?? []).map((f:any)=>({fact_id:f.fact_id,subject:f.subject??'',predicate:f.predicate??'',object:String(f.object??''),
      ...(typeof f.semantic_qualifiers?.speaker==='string'?{speaker:f.semantic_qualifiers.speaker}:{}),
      ...(typeof f.semantic_qualifiers?.viewpoint==='string'?{viewpoint:f.semantic_qualifiers.viewpoint}:{})})));
  };
  const save = async () => {
    if(!edits || !editBase || !sealed || !family || !onRevised || !canEdit) return;
    setBusy(true);setFailure('');setAcknowledged(false);
    try {
      const receipt=await reviseStudioFacts({sourceId:source.id,familyId:family.id,expected_hash:editBase.hash,
        expected_version:editBase.version,expected_source_updated_at:editBase.updatedAt,edits});
      setSaved(receipt);setEdits(null);
      setMessage(`Corrections enregistrées. Nouveau hash : ${receipt.new_hash}. Les questions A2 doivent être revues. Les faits ne sont pas confirmés.`);
      await onRevised();
    } catch(error:any) {
      setFailure(error?.message==='FACTS_REVISION_CONFLICT'
        ? 'Conflit : les données ont changé. Rechargez la source avant de reprendre vos corrections.'
        : `Enregistrement ou rafraîchissement refusé (${error?.message || 'erreur inconnue'}). Vos faits ne sont pas confirmés.`);
    } finally {setBusy(false);}
  };
  const alreadyOk = Boolean(
    confirmation && sealed && confirmation.facts_hash === sealed.facts_hash,
  );

  const confirm = async () => {
    if (edits || refreshPending || busy) return;
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
            <Badge variant="outline" className="max-w-full whitespace-normal break-all font-mono text-[11px]">{sealed.facts_hash}</Badge>
            {alreadyOk && <Badge>Confirmé</Badge>}
          </div>
          {message && <p role="status" className="break-all rounded border p-3 text-sm">{message}</p>}
          {failure && <p role="alert" className="rounded border border-destructive p-3 text-sm">{failure}</p>}
          {family?.payload?.facts_revision && <p className="text-sm">Faits corrigés : relisez les réponses et justifications A2 avant toute validation.</p>}
          {canEdit && onRevised && !edits && <Button disabled={busy || refreshPending} variant="outline" onClick={beginEditing}>Corriger les faits</Button>}
          <ul className="space-y-2">
            {sealed.facts.map((fact) => (
              <li key={fact.fact_id} className="rounded border p-3 text-sm">
                <p className="font-medium">{fact.fact_id}</p>
                {edits && !edits.some(e=>e.fact_id===fact.fact_id) && <p>Retrait proposé (non enregistré)</p>}
                <p>
                  {fact.subject} {fact.predicate} {String(fact.object ?? "")}
                </p>
                <p className="text-xs text-muted-foreground">
                  Segments : {(fact.provenance?.segment_refs ?? []).join(", ") || "aucun"} · Chunks :{" "}
                  {(fact.provenance?.chunk_refs ?? []).join(", ") || "aucun"}
                </p>
                <p className="text-xs">Preuve : {String((fact.provenance as any)?.quote ?? 'non renseignée')}</p>
                <p className="text-xs">Questions A2 : {references(fact.fact_id).map((item:any)=>`${item.id} — ${item.instruction}`).join(' ; ') || 'aucune'}</p>
                {supporting(fact.fact_id).length>0 && <p className="text-xs">Faits dépendants : {supporting(fact.fact_id).map(f=>f.fact_id).join(', ')}</p>}
                {edits?.filter(e=>e.fact_id===fact.fact_id).map(edit=><div key={edit.fact_id} className="mt-3 space-y-2">
                  <p>Avant : {fact.subject} {fact.predicate} {String(fact.object ?? '')}</p>
                  <p>Après : {edit.subject} {edit.predicate} {edit.object}</p>
                  <p className="text-xs">Attribution avant : {String((fact as any).semantic_qualifiers?.speaker ?? 'non renseignée')} / {String((fact as any).semantic_qualifiers?.viewpoint ?? 'non renseignée')}</p>
                  <p className="text-xs">Attribution après : {edit.speaker ?? 'non renseignée'} / {edit.viewpoint ?? 'non renseignée'}</p>
                  {(['subject','predicate','object','speaker','viewpoint'] as const).map((field,index)=><label className="block text-sm" key={field}>
                    {['Sujet','Prédicat','Objet','Locuteur','Point de vue'][index]} {fact.fact_id}
                    <input className="block w-full rounded border bg-background p-2" disabled={busy} maxLength={index<3?4000:200}
                      value={edit[field]??''} onChange={event=>setEdits(current=>current?.map(e=>e.fact_id===fact.fact_id?{...e,[field]:event.target.value}:e)??null)} />
                  </label>)}
                  <Button variant="outline" disabled={busy || references(fact.fact_id).length>0 || supporting(fact.fact_id).some(f=>edits.some(e=>e.fact_id===f.fact_id))}
                    onClick={()=>setEdits(edits.filter(e=>e.fact_id!==fact.fact_id))}>Retirer {fact.fact_id}</Button>
                  {references(fact.fact_id).length>0 && <p>Retrait impossible : une question A2 utilise ce fait.</p>}
                </div>)}
              </li>
            ))}
          </ul>
          {edits && <div className="flex flex-wrap gap-2">
            <Button disabled={busy || edits.length===0 || edits.some(e=>![e.subject,e.predicate,e.object].every(v=>v.trim()) || e.speaker!==undefined&&!e.speaker.trim() || e.viewpoint!==undefined&&!e.viewpoint.trim())} onClick={save}>Enregistrer les corrections</Button>
            <Button variant="outline" disabled={busy} onClick={()=>{setEdits(null);setFailure('');}}>Annuler les corrections</Button>
          </div>}
          {!alreadyOk && (
            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                disabled={busy || !!edits || refreshPending}
                checked={acknowledged}
                onCheckedChange={(value) => setAcknowledged(value === true)}
                aria-label="Je confirme que ces faits décrivent correctement l’audio"
              />
              <span>Je confirme que ces faits décrivent correctement l’audio.</span>
            </label>
          )}
          <Button
            disabled={busy || !!edits || refreshPending || divergent || (alreadyOk ? false : !acknowledged)}
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
