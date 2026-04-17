import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { UserX, Send, Loader2, AlertTriangle, CheckCircle2, FileText } from "lucide-react";

interface AbsentMakeupDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sessionId: string;
  groupId: string;
  userId: string;
  onSent?: () => void;
}

type DuplicateStrategy = "ignore" | "update";

export default function AbsentMakeupDialog({
  open, onOpenChange, sessionId, groupId, userId, onSent,
}: AbsentMakeupDialogProps) {
  const qc = useQueryClient();
  const [sending, setSending] = useState(false);
  const defaultDueDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  }, []);
  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [message, setMessage] = useState("");
  const [strategy, setStrategy] = useState<DuplicateStrategy>("ignore");
  const [summary, setSummary] = useState<{
    targeted: number;
    created: number;
    updated: number;
    skipped: number;
    errors: { eleve: string; error: string }[];
  } | null>(null);

  useEffect(() => {
    if (open) {
      setSummary(null);
      setDueDate(defaultDueDate);
      setMessage("");
      setStrategy("ignore");
    }
  }, [open, defaultDueDate]);

  // Fetch absent students (present = false)
  const { data: absents, isLoading: loadingAbsents } = useQuery({
    queryKey: ["absent-students", sessionId, groupId],
    queryFn: async () => {
      // Get all members
      const { data: members, error: errM } = await supabase
        .from("group_members")
        .select("eleve_id, profiles:eleve_id(id, nom, prenom)")
        .eq("group_id", groupId);
      if (errM) throw errM;

      // Get presences
      const { data: presences, error: errP } = await supabase
        .from("presences")
        .select("eleve_id, present")
        .eq("session_id", sessionId);
      if (errP) throw errP;

      const presentMap = new Map<string, boolean>();
      (presences ?? []).forEach((p: any) => presentMap.set(p.eleve_id, p.present));

      return (members ?? [])
        .filter((m: any) => presentMap.get(m.eleve_id) === false)
        .map((m: any) => ({
          eleve_id: m.eleve_id,
          nom: m.profiles?.nom || "",
          prenom: m.profiles?.prenom || "",
        }));
    },
    enabled: open && !!sessionId && !!groupId,
  });

  // Fetch session exercises (preserve order)
  const { data: sessionExs, isLoading: loadingExs } = useQuery({
    queryKey: ["session-exs-for-makeup", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("session_exercices")
        .select("exercice_id, ordre, exercice:exercices(id, titre)")
        .eq("session_id", sessionId)
        .order("ordre");
      if (error) throw error;
      return data ?? [];
    },
    enabled: open && !!sessionId,
  });

  const exerciseIds = useMemo(
    () => (sessionExs ?? []).map((se: any) => se.exercice_id).filter(Boolean),
    [sessionExs]
  );

  const handleSend = async () => {
    if (!absents || absents.length === 0) {
      toast.warning("Aucun élève absent à cibler.");
      return;
    }
    if (exerciseIds.length === 0) {
      toast.warning("Aucun exercice dans la séance à envoyer.");
      return;
    }

    setSending(true);
    try {
      const dueIso = new Date(`${dueDate}T23:59:00`).toISOString();
      const sourceLabel = "session_absent_makeup";
      const contexte = message ? `session_absent_makeup: ${message.slice(0, 200)}` : "session_absent_makeup";

      let created = 0;
      let updated = 0;
      let skipped = 0;
      const errors: { eleve: string; error: string }[] = [];

      // Fetch existing devoirs for these absentees + exercises (dedupe)
      const eleveIds = absents.map((a) => a.eleve_id);
      const { data: existing } = await supabase
        .from("devoirs")
        .select("id, eleve_id, exercice_id, statut")
        .eq("session_id", sessionId)
        .eq("source_label", sourceLabel)
        .in("eleve_id", eleveIds)
        .in("exercice_id", exerciseIds);

      const existingMap = new Map<string, { id: string; statut: string }>();
      (existing ?? []).forEach((d: any) =>
        existingMap.set(`${d.eleve_id}:${d.exercice_id}`, { id: d.id, statut: d.statut })
      );

      for (const eleve of absents) {
        try {
          const toInsert: any[] = [];
          const toUpdate: string[] = [];

          exerciseIds.forEach((exId, idx) => {
            const key = `${eleve.eleve_id}:${exId}`;
            const exists = existingMap.get(key);
            if (exists) {
              if (strategy === "update") {
                toUpdate.push(exists.id);
              } else {
                skipped += 1;
              }
            } else {
              toInsert.push({
                eleve_id: eleve.eleve_id,
                exercice_id: exId,
                formateur_id: userId,
                raison: "consolidation" as const,
                statut: "en_attente" as const,
                session_id: sessionId,
                contexte,
                source_label: sourceLabel,
                date_echeance: dueIso,
                serie: idx + 1,
              });
            }
          });

          if (toInsert.length > 0) {
            const { error } = await supabase.from("devoirs").insert(toInsert as any);
            if (error) throw error;
            created += toInsert.length;
          }
          if (toUpdate.length > 0) {
            const { error } = await supabase
              .from("devoirs")
              .update({
                date_echeance: dueIso,
                contexte,
                statut: "en_attente" as any,
                updated_at: new Date().toISOString(),
              })
              .in("id", toUpdate);
            if (error) throw error;
            updated += toUpdate.length;
          }
        } catch (e: any) {
          errors.push({ eleve: `${eleve.prenom} ${eleve.nom}`, error: e.message });
        }
      }

      setSummary({
        targeted: absents.length,
        created,
        updated,
        skipped,
        errors,
      });

      if (errors.length === 0) {
        toast.success(`Devoirs envoyés aux absents · ${created} créé(s)${updated > 0 ? `, ${updated} mis à jour` : ""}`);
      } else {
        toast.warning(`Envoi partiel · ${errors.length} erreur(s)`);
      }

      qc.invalidateQueries({ queryKey: ["session-homework-sent", sessionId] });
      qc.invalidateQueries({ queryKey: ["devoirs-formateur-all"] });
      qc.invalidateQueries({ queryKey: ["absent-makeup-history", sessionId] });
      onSent?.();
    } catch (e: any) {
      toast.error("Erreur d'envoi", { description: e.message });
    } finally {
      setSending(false);
    }
  };

  const isLoading = loadingAbsents || loadingExs;
  const noAbsents = !isLoading && (absents?.length ?? 0) === 0;
  const noExercises = !isLoading && exerciseIds.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserX className="h-5 w-5 text-orange-600" />
            Envoyer aux absents en devoir
          </DialogTitle>
          <DialogDescription>
            Transformer toute la séance en devoirs individuels pour les élèves absents.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2 min-h-0">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : summary ? (
            <div className="space-y-3">
              <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Récapitulatif
                </p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>👥 Élèves ciblés : <strong>{summary.targeted}</strong></div>
                  <div>✅ Devoirs créés : <strong>{summary.created}</strong></div>
                  {summary.updated > 0 && <div>🔄 Mis à jour : <strong>{summary.updated}</strong></div>}
                  {summary.skipped > 0 && <div>⏭️ Ignorés : <strong>{summary.skipped}</strong></div>}
                </div>
              </div>
              {summary.errors.length > 0 && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-1">
                  <p className="text-sm font-semibold text-destructive flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Erreurs ({summary.errors.length})
                  </p>
                  {summary.errors.map((er, i) => (
                    <p key={i} className="text-xs text-destructive">
                      • {er.eleve} : {er.error}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ) : noAbsents ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-green-500 opacity-70" />
              <p className="text-sm font-medium">Aucun élève absent 🎉</p>
              <p className="text-xs">Tous les élèves étaient présents lors de l'appel.</p>
            </div>
          ) : noExercises ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="h-10 w-10 mx-auto mb-2 text-orange-500 opacity-70" />
              <p className="text-sm font-medium">Aucun exercice dans la séance.</p>
            </div>
          ) : (
            <>
              {/* Absents list */}
              <div className="rounded-lg border p-3 space-y-2">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <UserX className="h-4 w-4 text-orange-600" />
                  Élèves absents ciblés ({absents!.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {absents!.map((a) => (
                    <Badge key={a.eleve_id} variant="secondary" className="text-xs">
                      {a.prenom} {a.nom}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Activities count */}
              <div className="rounded-lg border p-3 flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1 text-sm">
                  <p className="font-medium">{exerciseIds.length} activité(s) à envoyer</p>
                  <p className="text-xs text-muted-foreground">
                    Total : <strong>{exerciseIds.length * absents!.length}</strong> devoir(s) à créer
                    (ordre pédagogique conservé)
                  </p>
                </div>
              </div>

              {/* Due date */}
              <div className="space-y-1.5">
                <Label htmlFor="due-date" className="text-sm">Date limite</Label>
                <Input
                  id="due-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                />
              </div>

              {/* Message */}
              <div className="space-y-1.5">
                <Label htmlFor="msg" className="text-sm">Message d'accompagnement (optionnel)</Label>
                <Textarea
                  id="msg"
                  placeholder="Ex: Tu as manqué la séance, voici les exercices à rattraper avant le prochain cours."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={2}
                  maxLength={200}
                />
              </div>

              {/* Duplicate strategy */}
              <div className="space-y-1.5">
                <Label className="text-sm">Si un devoir a déjà été envoyé</Label>
                <RadioGroup value={strategy} onValueChange={(v) => setStrategy(v as DuplicateStrategy)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="ignore" id="r-ignore" />
                    <Label htmlFor="r-ignore" className="text-sm font-normal cursor-pointer">
                      Ignorer (ne pas créer de doublon)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="update" id="r-update" />
                    <Label htmlFor="r-update" className="text-sm font-normal cursor-pointer">
                      Mettre à jour (nouvelle date limite)
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="border-t pt-3 gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {summary ? "Fermer" : "Annuler"}
          </Button>
          {!summary && (
            <Button
              onClick={handleSend}
              disabled={sending || isLoading || noAbsents || noExercises}
              className="gap-2"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Envoyer aux absents
              {absents && exerciseIds.length > 0
                ? ` (${absents.length} × ${exerciseIds.length})`
                : ""}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
