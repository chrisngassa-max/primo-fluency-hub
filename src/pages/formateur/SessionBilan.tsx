import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Printer,
  Save,
  BookOpen,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SessionBilan = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingAction, setPendingAction] = useState<"devoir" | "reporter" | null>(null);

  // Fetch session exercices
  const { data: sessionExercices, isLoading } = useQuery({
    queryKey: ["session-bilan", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("session_exercices")
        .select("*, exercice:exercices(*)")
        .eq("session_id", id!)
        .order("ordre");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
  });

  // Fetch session info
  const { data: session } = useQuery({
    queryKey: ["session-info", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("*, group:groups(nom)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const exercises = sessionExercices ?? [];
  const checkedExercises = exercises.filter((e) => checkedIds.has(e.id));
  const uncheckedExercises = exercises.filter((e) => !checkedIds.has(e.id));

  const toggleCheck = (seId: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(seId)) next.delete(seId);
      else next.add(seId);
      return next;
    });
  };

  const handleValidate = () => {
    if (checkedIds.size === 0) {
      toast.error("Cochez au moins un exercice traité.");
      return;
    }
    if (uncheckedExercises.length > 0) {
      setConfirmOpen(true);
    } else {
      saveWithAction("none");
    }
  };

  const saveWithAction = async (action: "devoir" | "reporter" | "none") => {
    setSaving(true);
    try {
      // Mark checked exercises as traite_en_classe
      if (checkedIds.size > 0) {
        const { error: e1 } = await supabase
          .from("session_exercices")
          .update({ statut: "traite_en_classe" as any, updated_at: new Date().toISOString() })
          .in("id", Array.from(checkedIds));
        if (e1) throw e1;
      }

      // Handle unchecked exercises
      if (uncheckedExercises.length > 0) {
        if (action === "devoir") {
          // Mark as devoir_remediation in session_exercices
          const { error: e2 } = await supabase
            .from("session_exercices")
            .update({ statut: "devoir_remediation" as any, updated_at: new Date().toISOString() })
            .in("id", uncheckedExercises.map((e) => e.id));
          if (e2) throw e2;

          // Create devoirs for each student in the group
          if (session?.group_id) {
            const { data: members } = await supabase
              .from("group_members")
              .select("eleve_id")
              .eq("group_id", session.group_id);

            if (members && members.length > 0) {
              const devoirs = uncheckedExercises.flatMap((se) =>
                (members ?? []).map((m) => ({
                  eleve_id: m.eleve_id,
                  exercice_id: (se as any).exercice_id,
                  formateur_id: user!.id,
                  raison: "remediation" as const,
                  statut: "en_attente" as const,
                }))
              );
              const { error: e3 } = await supabase.from("devoirs").insert(devoirs);
              if (e3) throw e3;
            }
          }
        } else if (action === "reporter") {
          const { error: e2 } = await supabase
            .from("session_exercices")
            .update({ statut: "reporte" as any, updated_at: new Date().toISOString() })
            .in("id", uncheckedExercises.map((e) => e.id));
          if (e2) throw e2;
        }
      }

      // Update session status to terminee
      await supabase
        .from("sessions")
        .update({ statut: "terminee" as any, updated_at: new Date().toISOString() })
        .eq("id", id!);

      toast.success("Bilan de séance validé !", {
        description: `${checkedIds.size} traité(s), ${uncheckedExercises.length} ${action === "devoir" ? "en devoirs" : action === "reporter" ? "reporté(s)" : ""}`.trim(),
      });
      setConfirmOpen(false);
      navigate("/formateur/seances");
    } catch (e: any) {
      console.error(e);
      toast.error("Erreur", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => window.print();

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 print:hidden">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Bilan de séance</h1>
          <p className="text-sm text-muted-foreground">
            {session?.titre} · {(session as any)?.group?.nom} · {exercises.length} exercices
          </p>
        </div>
      </div>

      {/* Print header */}
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold">Fiche Séance — TCF Pro</h1>
        <p>{session?.titre} · {new Date().toLocaleDateString("fr-FR")}</p>
      </div>

      {/* Summary bar */}
      <div className="flex gap-3 text-sm print:hidden">
        <Badge variant="outline" className="gap-1 border-green-500/30 text-green-600">
          <CheckCircle2 className="h-3 w-3" />
          {checkedIds.size} traité(s)
        </Badge>
        <Badge variant="outline" className="gap-1 border-orange-500/30 text-orange-600">
          <ArrowRight className="h-3 w-3" />
          {uncheckedExercises.length} restant(s)
        </Badge>
      </div>

      {/* Exercise list with checkboxes */}
      <div className="space-y-2">
        {exercises.map((se, i) => {
          const ex = (se as any).exercice;
          const isChecked = checkedIds.has(se.id);
          return (
            <Card
              key={se.id}
              className={cn(
                "transition-all cursor-pointer print:break-inside-avoid",
                isChecked && "border-green-500/30 bg-green-50/50 dark:bg-green-950/10"
              )}
              onClick={() => toggleCheck(se.id)}
            >
              <CardContent className="py-3 px-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={() => toggleCheck(se.id)}
                    className="mt-1 print:hidden"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex items-center justify-center h-7 w-7 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{ex?.titre || "Exercice"}</span>
                      <Badge variant="secondary" className="text-[10px]">{ex?.competence}</Badge>
                      <Badge variant="outline" className="text-[10px]">{ex?.format?.replace(/_/g, " ")}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{ex?.consigne}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {exercises.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <BookOpen className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">
              Aucun exercice rattaché à cette séance.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Action bar */}
      <div className="flex gap-2 print:hidden">
        <Button onClick={handleValidate} className="flex-1" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Valider la séance
        </Button>
        <Button variant="outline" onClick={handlePrint}>
          <Printer className="h-4 w-4 mr-2" />
          Imprimer
        </Button>
      </div>

      {/* Confirmation dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exercices non traités</DialogTitle>
            <DialogDescription>
              {uncheckedExercises.length} exercice(s) n'ont pas été traité(s) en classe.
              Que souhaitez-vous en faire ?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            {uncheckedExercises.map((se, i) => (
              <div key={se.id} className="text-sm flex items-center gap-2">
                <span className="text-muted-foreground">•</span>
                <span>{(se as any).exercice?.titre || `Exercice ${i + 1}`}</span>
              </div>
            ))}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="default"
              onClick={() => saveWithAction("devoir")}
              disabled={saving}
              className="flex-1"
            >
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <BookOpen className="h-4 w-4 mr-2" />}
              Envoyer en devoirs
            </Button>
            <Button
              variant="outline"
              onClick={() => saveWithAction("reporter")}
              disabled={saving}
              className="flex-1"
            >
              <ArrowRight className="h-4 w-4 mr-2" />
              Reporter à la prochaine séance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print styles */}
      <style>{`
        @media print {
          nav, header, .print\\:hidden { display: none !important; }
          body { font-size: 12pt; }
        }
      `}</style>
    </div>
  );
};

export default SessionBilan;
