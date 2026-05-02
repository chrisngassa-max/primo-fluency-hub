import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Send, X, AlertTriangle, Wand2 } from "lucide-react";
import { format, addDays } from "date-fns";

type ObjectifStatus = "absent" | "non_atteint" | "a_consolider" | "atteint" | "au_dela";
type DevoirType = "rattrapage" | "remediation" | "consolidation" | "consolidation_courte" | "approfondissement";

interface Outcome {
  id: string;
  eleve_id: string;
  objectif_status: ObjectifStatus | null;
  besoin_pedagogique: string | null;
  devoir_recommande: string | null;
  prenom: string;
  nom: string;
}

interface SessionExerciseRow {
  exercice_id: string;
  ordre: number;
  is_bonus: boolean | null;
  exercice: {
    id: string;
    titre: string | null;
    competence: string | null;
    difficulte: number | null;
    format: string | null;
    variante_niveau_bas: any | null;
    variante_niveau_haut: any | null;
  } | null;
}

interface Proposal {
  eleve_id: string;
  prenom: string;
  nom: string;
  objectif_status: ObjectifStatus | null;
  besoin_pedagogique: string | null;
  devoir_recommande: string | null;
  devoir_type: DevoirType;
  exercice_id: string | null;
  send: boolean; // checkbox final d'envoi
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

/**
 * Sélectionne automatiquement l'exercice le plus pertinent pour un type
 * de besoin donné, parmi les exercices de la séance.
 *
 *  - rattrapage           → premier exercice non-bonus (tronc commun)
 *  - remediation          → exercice non-bonus avec la difficulté la plus basse,
 *                           bonus si une variante_niveau_bas existe
 *  - consolidation        → exercice non-bonus de difficulté moyenne (3)
 *  - consolidation_courte → exercice non-bonus de difficulté ≤ 3, court
 *  - approfondissement    → exercice marqué bonus, sinon difficulté la plus
 *                           haute, bonus si variante_niveau_haut existe
 */
function pickExerciseForType(
  type: DevoirType,
  sessionExercises: SessionExerciseRow[],
): string | null {
  if (sessionExercises.length === 0) return null;
  const nonBonus = sessionExercises.filter((s) => !s.is_bonus);
  const bonus = sessionExercises.filter((s) => s.is_bonus);

  const score = (s: SessionExerciseRow, target: number, hasVariantBonus: "bas" | "haut" | null): number => {
    const diff = s.exercice?.difficulte ?? 3;
    let sc = -Math.abs(diff - target);
    if (hasVariantBonus === "bas" && s.exercice?.variante_niveau_bas) sc += 2;
    if (hasVariantBonus === "haut" && s.exercice?.variante_niveau_haut) sc += 2;
    return sc;
  };

  const sortedByScore = (target: number, vb: "bas" | "haut" | null) =>
    [...nonBonus].sort((a, b) => score(b, target, vb) - score(a, target, vb));

  switch (type) {
    case "rattrapage": {
      const ord = [...nonBonus].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
      return ord[0]?.exercice_id ?? sessionExercises[0]?.exercice_id ?? null;
    }
    case "remediation":
      return sortedByScore(1, "bas")[0]?.exercice_id ?? null;
    case "consolidation":
      return sortedByScore(3, null)[0]?.exercice_id ?? null;
    case "consolidation_courte":
      return sortedByScore(2, null)[0]?.exercice_id ?? null;
    case "approfondissement": {
      if (bonus.length > 0) {
        const ord = [...bonus].sort((a, b) => (b.exercice?.difficulte ?? 0) - (a.exercice?.difficulte ?? 0));
        return ord[0].exercice_id;
      }
      return sortedByScore(5, "haut")[0]?.exercice_id ?? null;
    }
    default:
      return nonBonus[0]?.exercice_id ?? null;
  }
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
      const { data: o2, error: e2 } = await supabase
        .from("session_student_outcomes")
        .select("id, eleve_id, objectif_status, besoin_pedagogique, devoir_recommande")
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
    },
  });

  const { data: sessionExercises = [] } = useQuery({
    queryKey: ["outcome-session-exercises-detailed", sessionId],
    enabled: open && !!sessionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("session_exercices")
        .select(`
          exercice_id, ordre, is_bonus,
          exercice:exercices (
            id, titre, competence, difficulte, format,
            variante_niveau_bas, variante_niveau_haut
          )
        `)
        .eq("session_id", sessionId)
        .order("ordre");
      if (error) throw error;
      return (data ?? []) as SessionExerciseRow[];
    },
  });

  // Initialise les propositions
  useEffect(() => {
    if (!data) return;
    setProposals(
      data.map((o) => {
        const t = statusToType(o.objectif_status);
        const exId = pickExerciseForType(t, sessionExercises);
        return {
          eleve_id: o.eleve_id,
          prenom: o.prenom,
          nom: o.nom,
          objectif_status: o.objectif_status,
          besoin_pedagogique: o.besoin_pedagogique,
          devoir_recommande: o.devoir_recommande,
          devoir_type: t,
          exercice_id: exId,
          send: !!exId, // pas de tick si pas d'exercice
        };
      })
    );
  }, [data, sessionExercises]);

  const updateProposal = (idx: number, patch: Partial<Proposal>) => {
    setProposals((prev) =>
      prev.map((p, i) => {
        if (i !== idx) return p;
        const next = { ...p, ...patch };
        // si on change le type → recalcul auto de l'exercice
        if (patch.devoir_type && patch.exercice_id === undefined) {
          next.exercice_id = pickExerciseForType(patch.devoir_type, sessionExercises);
        }
        // si on désélectionne l'exercice ("none") on bloque l'envoi
        if (patch.exercice_id === null) next.send = false;
        return next;
      })
    );
  };

  const includedCount = useMemo(
    () => proposals.filter((p) => p.send && p.exercice_id).length,
    [proposals]
  );

  const exerciseOptions = useMemo(
    () =>
      sessionExercises
        .filter((s) => !!s.exercice_id)
        .map((s) => ({
          id: s.exercice_id,
          label:
            (s.exercice?.titre || "Exercice sans titre") +
            (s.is_bonus ? " · bonus" : "") +
            (s.exercice?.competence ? ` (${s.exercice.competence})` : "") +
            (typeof s.exercice?.difficulte === "number" ? ` · diff ${s.exercice.difficulte}` : ""),
        })),
    [sessionExercises]
  );

  const handleSend = async () => {
    const toSend = proposals.filter((p) => p.send && p.exercice_id);
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

  const noExercisesAtAll = sessionExercises.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl max-h-[88vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Proposer les devoirs depuis le bilan élève</DialogTitle>
          <DialogDescription>
            Vérifie et ajuste les devoirs proposés à partir de l'observation par élève.
            Rien n'est envoyé sans ta validation. Côté élève, tout apparaîtra sous
            l'intitulé neutre « Ton travail pour cette semaine ».
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="font-medium">Échéance :</label>
          <Input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-auto"
          />
          <Badge variant="secondary">{includedCount} devoir(s) sélectionné(s)</Badge>
          {noExercisesAtAll && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" /> Aucun exercice dans la séance
            </Badge>
          )}
        </div>

        {noExercisesAtAll && (
          <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm">
            <p className="font-medium mb-1 flex items-center gap-2">
              <Wand2 className="h-4 w-4" /> Aucun exercice rattaché à cette séance
            </p>
            <p className="text-muted-foreground">
              Ajoute au moins un exercice à la séance pour pouvoir proposer des devoirs ici.
              Tu peux aussi générer une série de devoirs individuelle via la fonction « Nouvelle série de devoirs »
              depuis le pilotage de séance.
            </p>
          </div>
        )}

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
                  <TableHead>Besoin</TableHead>
                  <TableHead className="min-w-[200px]">Devoir recommandé</TableHead>
                  <TableHead className="min-w-[180px]">Type</TableHead>
                  <TableHead className="min-w-[280px]">Exercice envoyé</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proposals.map((p, idx) => {
                  const noMatch = !p.exercice_id;
                  return (
                    <TableRow key={p.eleve_id} className={noMatch ? "bg-amber-50/60 dark:bg-amber-950/20" : ""}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={p.send}
                          disabled={!p.exercice_id}
                          onChange={(e) => updateProposal(idx, { send: e.target.checked })}
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
                        <span className="text-xs text-muted-foreground">
                          {p.besoin_pedagogique ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground line-clamp-2">
                          {p.devoir_recommande?.trim() || `${TYPE_LABEL[p.devoir_type]} suite à la séance`}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={p.devoir_type}
                          onValueChange={(v) => updateProposal(idx, { devoir_type: v as DevoirType, exercice_id: undefined as any })}
                        >
                          <SelectTrigger className="h-8 w-[180px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(TYPE_LABEL) as DevoirType[]).map((t) => (
                              <SelectItem key={t} value={t}>
                                <Badge className={TYPE_BADGE[t]} variant="secondary">{TYPE_LABEL[t]}</Badge>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {exerciseOptions.length === 0 ? (
                          <span className="text-xs text-destructive">
                            Aucun exercice adapté trouvé.
                          </span>
                        ) : (
                          <Select
                            value={p.exercice_id ?? "__none__"}
                            onValueChange={(v) =>
                              updateProposal(idx, {
                                exercice_id: v === "__none__" ? null : v,
                              })
                            }
                          >
                            <SelectTrigger className="h-8 w-full max-w-[320px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">
                                <span className="text-muted-foreground">Ne pas envoyer à cet élève</span>
                              </SelectItem>
                              {exerciseOptions.map((opt) => (
                                <SelectItem key={opt.id} value={opt.id!}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        {noMatch && exerciseOptions.length > 0 && (
                          <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                            Aucun exercice ne correspond automatiquement — choisis-en un manuellement.
                          </p>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
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
