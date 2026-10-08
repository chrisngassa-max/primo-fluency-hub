import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { buildAttendanceSummary, parisDay, type SummaryMember } from "@/lib/attendanceSummary";
import { createAttendancePdf } from "@/lib/attendanceSummaryPdf";
import { toast } from "sonner";

// Every source is paginated: an export must never silently stop at the API row limit.
async function allPages<T>(fetchPage: (offset: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const result: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await fetchPage(offset);
    if (error) throw error;
    result.push(...(data ?? []));
    if ((data?.length ?? 0) < 500) return result;
  }
}

export default function AttendanceSummaryDialog({ group, members }: {
  group: { id: string; nom: string }; members: { eleve_id: string; joined_at?: string; eleve?: { nom?: string; prenom?: string } }[];
}) {
  const [open, setOpen] = useState(false);
  const [training, setTraining] = useState("");
  const [whole, setWhole] = useState(true);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["attendance-summary", group.id], enabled: open, staleTime: 0,
    queryFn: async () => {
      const [sessions, memberships] = await Promise.all([
        allPages(offset => supabase.from("sessions").select("id,date_seance,duree_minutes,statut").eq("group_id", group.id).order("id").range(offset, offset + 499)),
        allPages(offset => supabase.from("group_members").select("eleve_id,joined_at").eq("group_id", group.id).order("id").range(offset, offset + 499)),
      ]);
      const presences = [];
      for (let i = 0; i < sessions.length; i += 100) {
        presences.push(...await allPages(offset => supabase.from("presences").select("session_id,eleve_id,present,commentaire").in("session_id", sessions.slice(i, i + 100).map(s => s.id)).order("id").range(offset, offset + 499)));
      }
      const ids = [...new Set([...memberships.map(m => m.eleve_id), ...presences.map(p => p.eleve_id)])];
      const identities = new Map(members.map(m => [m.eleve_id, m.eleve]));
      for (let i = 0; i < ids.length; i += 100) {
        const profiles = await allPages(offset => supabase.from("profiles").select("id,nom,prenom").in("id", ids.slice(i, i + 100)).order("id").range(offset, offset + 499));
        profiles.forEach(p => { if (p.nom && p.prenom) identities.set(p.id, p); });
      }
      const participants: SummaryMember[] = ids.map(id => ({
        eleve_id: id, nom: identities.get(id)?.nom ?? "", prenom: identities.get(id)?.prenom ?? "",
        // Former members: only recorded sessions can be attributed reliably.
        joined_at: memberships.find(m => m.eleve_id === id)?.joined_at ?? "9999-01-01T00:00:00Z",
      }));
      return { sessions, presences, participants, former: ids.some(id => !memberships.some(m => m.eleve_id === id)) };
    },
  });
  const validPeriod = whole || (!!start && !!end && start <= end);
  const summary = useMemo(() => query.data && validPeriod ? buildAttendanceSummary(query.data.participants, query.data.sessions, query.data.presences, whole ? undefined : { start, end }) : null, [query.data, validPeriod, whole, start, end]);
  const period = whole ? (() => {
    const days = query.data?.sessions.filter(s => s.statut !== "annulee").map(s => parisDay(s.date_seance)).sort() ?? [];
    return days.length ? `Ensemble de la formation : du ${displayDate(days[0])} au ${displayDate(days[days.length - 1])}` : "Ensemble de la formation";
  })() : `Du ${displayDate(start)} au ${displayDate(end)}`;
  const identityMissing = query.data?.participants.some(p => !p.nom || !p.prenom);
  const canExport = summary && !query.isFetching && !query.isError && training.trim() && !identityMissing && !summary.errors.length && (!summary.missing.length || acknowledged);
  useEffect(() => { setAcknowledged(false); setPreview(null); }, [start, end, whole, training, query.data]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const pdf = () => createAttendancePdf(group.nom, training.trim(), period, summary!.rows);
  return <Dialog open={open} onOpenChange={value => { setOpen(value); if (!value) { setPreview(null); setAcknowledged(false); } }}>
    <DialogTrigger asChild><Button variant="outline" size="sm">Exporter le bilan de présence</Button></DialogTrigger>
    <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Bilan de présence — {group.nom}</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div><Label htmlFor={`training-${group.id}`}>Intitulé de la formation</Label><Input id={`training-${group.id}`} value={training} onChange={e => setTraining(e.target.value)} placeholder="Intitulé de la formation" /></div>
        <label className="flex items-center gap-2"><input type="checkbox" checked={whole} onChange={e => setWhole(e.target.checked)} />Ensemble de la formation</label>
        {!whole && <div className="flex gap-4"><div><Label htmlFor={`start-${group.id}`}>Du</Label><Input id={`start-${group.id}`} type="date" value={start} onChange={e => setStart(e.target.value)} /></div><div><Label htmlFor={`end-${group.id}`}>Au (inclus)</Label><Input id={`end-${group.id}`} type="date" value={end} onChange={e => setEnd(e.target.value)} /></div></div>}
        {!validPeriod && <p role="alert">Choisissez une période valide (début antérieur ou égal à la fin).</p>}
        {query.isFetching && <p role="status">Chargement des séances et des appels…</p>}
        {query.isError && <div role="alert">Impossible de charger les appels. <Button variant="outline" onClick={() => query.refetch()}>Réessayer</Button></div>}
        {identityMissing && <p role="alert">Des noms ou prénoms sont manquants. Complétez les profils avant l'export.</p>}
        {query.data?.former && <p role="alert">Anciens participants inclus : seules leurs séances avec un appel enregistré sont attribuables. L'historique des inscriptions n'est pas disponible ; leurs heures prévues peuvent être incomplètes.</p>}
        {!!summary?.errors.length && <div role="alert">{summary.errors.map(message => <p key={message}>{message}</p>)}</div>}
        {!!summary?.missing.length && <div className="border rounded p-3 space-y-2" role="alert">
          <p>{summary.missing.length} appel(s) non renseigné(s), exclus des présences et absences.</p>
          <details><summary>Voir les données manquantes</summary><ul>{summary.missing.map((m, i) => <li key={i}>{m}</li>)}</ul></details>
          <label className="flex gap-2"><input type="checkbox" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} />J'ai pris connaissance des appels manquants.</label>
        </div>}
        {summary && !summary.rows.length && <p>Aucun participant sur ce groupe.</p>}
        <div className="flex gap-2">
          <Button disabled={!canExport || !summary?.rows.length} onClick={() => { try { setPreview(URL.createObjectURL(pdf().output("blob"))); } catch (e) { toast.error((e as Error).message); } }}>Afficher l’aperçu</Button>
          <Button disabled={!canExport || !summary?.rows.length} onClick={() => { try { pdf().save(`bilan-presence-${group.nom.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`); } catch (e) { toast.error((e as Error).message); } }}>Exporter le PDF A4 paysage</Button>
        </div>
        {preview && <iframe title="Aperçu du bilan de présence" src={preview} className="w-full h-[60vh] border" />}
      </div>
    </DialogContent>
  </Dialog>;
}
function displayDate(day: string) { return day ? day.split("-").reverse().join("/") : ""; }
