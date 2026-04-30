import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Send, Pencil, Check, X } from "lucide-react";
import { format, addDays } from "date-fns";

type ObjectifStatus = "absent" | "non_atteint" | "a_consolider" | "atteint" | "au_dela";
type DevoirType = "rattrapage" | "remediation" | "consolidation" | "consolidation_courte" | "approfondissement";

interface Outcome {
  id: string;
  eleve_id: string;
  objectif_status: ObjectifStatus | null;
  devoir_recommande: string | null;
  prenom: string;
  nom: string;
}

interface Proposal {
  eleve_id: string;
  prenom: string;
  nom: string;
  objectif_status: ObjectifStatus | null;
  devoir_type: DevoirType;
  exercice_id: string | null;
  description: string;
  include: boolean;
  editing: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  formateurId: string;
  defaultDeadlineDays?: number;
  onSent?: () => void;
}

const STATUS_LABEL: Record<ObjectifStatus, string> = {
  absent: "Absent",
  non_atteint: "Non atteint",
  a_consolider: "À consolider",
  atteint: "Atteint",
  au_dela: "Au-delà",
};

const TYPE_LABEL: Record<DevoirType, string> = {
  rattrapage: "Rattrapage tronc commun",
  remediation: "Remédiation",
  consolidation: "Consolidation",
  consolidation_courte: "Consolidation courte",
  approfondissement: "Approfondissement / bonus",
};

const TYPE_BADGE: Record<DevoirType, string> = {
  rattrapage: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  remediation: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  consolidation: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  consolidation_courte: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  approfondissement: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
};

function statusToType(status: ObjectifStatus | null): DevoirType {
  switch (status) {
    case "absent": return "rattrapage";
    case "non_atteint": return "remediation";
    case "a_consolider": return "consolidation";
    case "atteint": return "consolidation_courte";
    case "au_dela": return "approfondissement";
    default: return "consolidation";
  }
}

function typeToRaison(t: DevoirType): "remediation" | "consolidation" {
  return t === "remediation" ? "remediation" : "consolidation";
}

function typeToSourceLabel(t: DevoirType): string {
  return `outcome_${t}`;
}

export default function OutcomeDevoirsPreviewDialog({
  open, onOpenChange, sessionId, formateurId, defaultDeadlineDays = 7, onSent,
}: Props) {
  const qc = useQueryClient();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [sending, setSending] = useState(false);
  const [deadline, setDeadline] = useState<string>(
    format(addDays(new Date(), defaultDeadlineDays), "yyyy-MM-dd")
  );

  const { data, isLoading } = useQuery({
    queryKey: ["outcome-devoirs-preview", sessionId],
    enabled: open && !!sessionId,
    queryFn: async () => {
      const { data: outcomes, error } = await supabase
        .from("session_student_outcomes")
        .select("id, eleve_id, objectif_status, devoir_recommande, profiles!session_student_outcomes_eleve_id_fkey(prenom, nom)")
        .eq("session_id", sessionId);
      if (error) {
        // Fallback without explicit FK name (no FK constraint declared)
        const { data: o2, error: e2 } = await supabase
          .from("session_student_outcomes")
          .select("id, eleve_id, objectif_status, devoir_recommande")
          .eq("session_id", sessionId);
        if (e2) throw e2;
        const ids = (o2 ?? []).map((o: any) => o.eleve_id);
        const { data: profs } = ids.length > 0
          ? await supabase.from("profiles").select("id, prenom, nom").in("id", ids)
          : { data: [] };
        const profMap = new Map((profs ?? []).map((p: any) => [p.id, p]));
        return (o2 ?? []).map((o: any) => ({
          ...o,
          prenom: profMap.get(o.eleve_id)?.prenom ?? "",
          nom: profMap.get(o.eleve_id)?.nom ?? "",
        })) as Outcome[];
      }
      return (outcomes ?? []).map((o: any) => ({
        id: o.id,
        eleve_id: o.eleve_id,
        objectif_status: o.objectif_status,
        devoir_recommande: o.devoir_recommande,
        prenom: o.profiles?.prenom ?? "",
        nom: o.profiles?.nom ?? "",
      })) as Outcome[];
    },
  });

  // Look up a candidate exercise for each student's session (tronc commun)
  const { data: sessionExercises } = useQuery({
    queryKey: ["outcome-session-exercises", sessionId],
    enabled: open && !!sessionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("session_exercices")
        .select("exercice_id, ordre")
        .eq("session_id", sessionId)
        .order("ordre");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!data) return;
    const fallbackExId = sessionExercises?.[0]?.exercice_id ?? null;
    setProposals(
      data.map((o) => {
        const t = statusToType(o.objectif_status);
        return {
          eleve_id: o.eleve_id,
          prenom: o.prenom,
          nom: o.nom,
          objectif_status: o.objectif_status,
          devoir_type: t,
          exercice_id: fallbackExId,
          description:
            o.devoir_recommande?.trim() ||
            `${TYPE_LABEL[t]} suite à la séance`,
          include: !!fallbackExId, // can't send without an exercise
          editing: false,
        };
      })
    );
  }, [data, sessionExercises]);

  const updateProposal = (idx: number, patch: Partial<Proposal>) => {
    setProposals((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const includedCount = useMemo(() => proposals.filter((p) => p.include).length, [proposals]);

  const handleSend = async () => {
    const toSend = proposals.filter((p) => p.include && p.exercice_id);
    if (toSend.length === 0) {
      toast.error("Aucun devoir à envoyer.");
      return;
    }
    setSending(true);
    try {
      const dueIso = new Date(`${deadline}T23:59:00`).toISOString();
      const rows = toSend.map((p) => ({
        eleve_id: p.eleve_id,
        exercice_id: p.exercice_id!,
        formateur_id: formateurId,
        session_id: sessionId,
        contexte: "devoir",
        raison: typeToRaison(p.devoir_type),
        source_label: typeToSourceLabel(p.devoir_type),
        statut: "en_attente" as const,
        date_echeance: dueIso,
      }));
      const { error } = await supabase.from("devoirs").insert(rows as any);
      if (error) throw error;
      toast.success(`${rows.length} devoir(s) envoyé(s)`);
      qc.invalidateQueries({ queryKey: ["devoirs-formateur-all"] });
      qc.invalidateQueries({ queryKey: ["session-homework-sent", sessionId] });
      onSent?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Erreur d'envoi", { description: e.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Proposer les devoirs depuis le bilan élève</DialogTitle>
          <DialogDescription>
            Vérifie les recommandations issues de l'observation par élève. Rien n'est envoyé sans ta validation.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 text-sm">
          <label className="font-medium">Échéance :</label>
          <Input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-auto"
          />
          <Badge variant="secondary">{includedCount} devoir(s) sélectionné(s)</Badge>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 border rounded-md">
          {isLoading ? (
            <div className="py-10 text-center">
              <Loader2 className="h-5 w-5 animate-spin mx-auto" />
            </div>
          ) : proposals.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Aucune observation enregistrée pour cette séance.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">Envoyer</TableHead>
                  <TableHead>Élève</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Type de devoir</TableHead>
                  <TableHead className="min-w-[280px]">Devoir recommandé</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proposals.map((p, idx) => (
                  <TableRow key={p.eleve_id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={p.include}
                        disabled={!p.exercice_id}
                        onChange={(e) => updateProposal(idx, { include: e.target.checked })}
                        className="h-4 w-4"
                      />
                    </TableCell>
                    <TableCell className="font-medium">{p.prenom} {p.nom}</TableCell>
                    <TableCell>
                      {p.objectif_status ? (
                        <Badge variant="outline">{STATUS_LABEL[p.objectif_status]}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {p.editing ? (
                        <Select
                          value={p.devoir_type}
                          onValueChange={(v) => updateProposal(idx, { devoir_type: v as DevoirType })}
                        >
                          <SelectTrigger className="h-8 w-[200px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(TYPE_LABEL) as DevoirType[]).map((t) => (
                              <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge className={TYPE_BADGE[p.devoir_type]} variant="secondary">
                          {TYPE_LABEL[p.devoir_type]}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {p.editing ? (
                        <Textarea
                          value={p.description}
                          onChange={(e) => updateProposal(idx, { description: e.target.value })}
                          className="min-h-[60px] text-sm"
                        />
                      ) : (
                        <span className="text-sm text-muted-foreground">{p.description}</span>
                      )}
                      {!p.exercice_id && (
                        <p className="text-xs text-destructive mt-1">
                          Aucun exercice trouvé dans la séance — impossible d'envoyer.
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => updateProposal(idx, { editing: !p.editing })}
                      >
                        {p.editing ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <DialogFooter className="gap-2 border-t pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            <X className="h-4 w-4 mr-2" /> Annuler
          </Button>
          <Button onClick={handleSend} disabled={sending || includedCount === 0}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Valider et envoyer ({includedCount})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
