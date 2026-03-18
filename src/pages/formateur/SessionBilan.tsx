import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
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
  Sparkles,
  AlertTriangle,
  Brain,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const COMPETENCES = ["CO", "CE", "EE", "EO", "Structures"] as const;

interface BilanScores {
  CO: number;
  CE: number;
  EE: number;
  EO: number;
  Structures: number;
}

interface BlockedStudent {
  nom: string;
  competence: string;
}

const SessionBilan = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Bilan scores per competence
  const [bilanScores, setBilanScores] = useState<BilanScores>({
    CO: 50, CE: 50, EE: 50, EO: 50, Structures: 50,
  });
  const [blockedStudents, setBlockedStudents] = useState<BlockedStudent[]>([]);
  const [newBlockedName, setNewBlockedName] = useState("");
  const [newBlockedCompetence, setNewBlockedCompetence] = useState("CO");
  const [bilanNotes, setBilanNotes] = useState("");

  // Adaptation IA
  const [adapting, setAdapting] = useState(false);
  const [adaptationResult, setAdaptationResult] = useState<any>(null);
  const [showAdaptation, setShowAdaptation] = useState(false);

  // Fetch formateur settings for auto_adapt
  const { data: formateurParams } = useQuery({
    queryKey: ["formateur-parametres-bilan", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parametres")
        .select("*")
        .eq("formateur_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const isAutoAdapt = (formateurParams as any)?.auto_adapt ?? false;

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

  const { data: session } = useQuery({
    queryKey: ["session-info", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("*, group:groups(nom, id)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Find next session for this group
  const { data: nextSession } = useQuery({
    queryKey: ["next-session", session?.group_id, id],
    queryFn: async () => {
      if (!session) return null;
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .eq("group_id", (session as any).group?.id || session.group_id)
        .eq("statut", "planifiee")
        .gt("date_seance", session.date_seance)
        .order("date_seance")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!session,
  });

  const exercises = sessionExercices ?? [];
  const uncheckedExercises = exercises.filter((e) => !checkedIds.has(e.id));

  const toggleCheck = (seId: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(seId)) next.delete(seId);
      else next.add(seId);
      return next;
    });
  };

  const addBlockedStudent = () => {
    if (!newBlockedName.trim()) return;
    setBlockedStudents((prev) => [
      ...prev,
      { nom: newBlockedName.trim(), competence: newBlockedCompetence },
    ]);
    setNewBlockedName("");
  };

  const removeBlockedStudent = (index: number) => {
    setBlockedStudents((prev) => prev.filter((_, i) => i !== index));
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
      if (checkedIds.size > 0) {
        const { error: e1 } = await supabase
          .from("session_exercices")
          .update({ statut: "traite_en_classe" as any, updated_at: new Date().toISOString() })
          .in("id", Array.from(checkedIds));
        if (e1) throw e1;
      }

      if (uncheckedExercises.length > 0) {
        if (action === "devoir") {
          const { error: e2 } = await supabase
            .from("session_exercices")
            .update({ statut: "devoir_remediation" as any, updated_at: new Date().toISOString() })
            .in("id", uncheckedExercises.map((e) => e.id));
          if (e2) throw e2;

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

      await supabase
        .from("sessions")
        .update({ statut: "terminee" as any, updated_at: new Date().toISOString() })
        .eq("id", id!);

      toast.success("Bilan de séance validé !", {
        description: `${checkedIds.size} traité(s), ${uncheckedExercises.length} ${action === "devoir" ? "en devoirs" : action === "reporter" ? "reporté(s)" : ""}`.trim(),
      });
      setConfirmOpen(false);

      // Trigger AI adaptation
      if (nextSession) {
        await triggerAdaptation();
      } else {
        navigate("/formateur/seances");
      }
    } catch (e: any) {
      console.error(e);
      toast.error("Erreur", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const triggerAdaptation = async () => {
    setAdapting(true);
    try {
      const exercicesTraites = exercises
        .filter((e) => checkedIds.has(e.id))
        .map((e) => (e as any).exercice?.titre);
      const exercicesNonTraites = uncheckedExercises.map(
        (e) => (e as any).exercice?.titre
      );

      const { data, error } = await supabase.functions.invoke("adapt-next-session", {
        body: {
          sessionTitle: session?.titre,
          bilanScores,
          blockedStudents,
          exercicesTraites,
          exercicesNonTraites,
          nextSessionTitle: nextSession?.titre,
          nextSessionObjectifs: nextSession?.objectifs,
          nextSessionNiveauCible: nextSession?.niveau_cible,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setAdaptationResult(data.adaptation);

      // Auto-apply if pilote automatique is enabled
      if (isAutoAdapt && nextSession) {
        await autoApplyAdaptation(data.adaptation);
      } else {
        setShowAdaptation(true);
      }
    } catch (e: any) {
      console.error(e);
      toast.error("L'adaptation IA a échoué", { description: e.message });
      navigate("/formateur/seances");
    } finally {
      setAdapting(false);
    }
  };

  const autoApplyAdaptation = async (adaptation: any) => {
    if (!nextSession) return;
    try {
      await supabase
        .from("sessions")
        .update({
          objectifs: adaptation.objectifs_ajustes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", nextSession.id);

      await supabase.from("notifications").insert({
        user_id: user!.id,
        titre: "Séance auto-adaptée par l'IA",
        message: adaptation.message_formateur,
        link: `/formateur/seances/${nextSession.id}/pilote`,
      });

      qc.invalidateQueries({ queryKey: ["formateur-sessions"] });
      toast.success("Pilote automatique — Séance N+1 adaptée !", {
        description: adaptation.message_formateur,
      });
      navigate("/formateur/seances");
    } catch (e: any) {
      toast.error("Erreur d'auto-adaptation", { description: e.message });
      navigate("/formateur/seances");
    }
  };

  const applyAdaptation = async () => {
    if (!nextSession || !adaptationResult) return;
    setSaving(true);
    try {
      await supabase
        .from("sessions")
        .update({
          objectifs: adaptationResult.objectifs_ajustes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", nextSession.id);

      await supabase.from("notifications").insert({
        user_id: user!.id,
        titre: "Séance adaptée par l'IA",
        message: adaptationResult.message_formateur,
        link: `/formateur/seances/${nextSession.id}/pilote`,
      });

      qc.invalidateQueries({ queryKey: ["formateur-sessions"] });
      toast.success("Séance N+1 adaptée !", {
        description: adaptationResult.message_formateur,
      });
      setShowAdaptation(false);
      navigate("/formateur/seances");
    } catch (e: any) {
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

      {/* Exercise list */}
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
            <p className="text-muted-foreground">Aucun exercice rattaché à cette séance.</p>
          </CardContent>
        </Card>
      )}

      {/* Bilan de fin de cours */}
      <Card className="border-primary/20 print:hidden">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Bilan de fin de cours
          </CardTitle>
          <CardDescription>
            Évaluez le groupe par compétence et signalez les blocages
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Score par compétence */}
          <div className="space-y-4">
            <Label className="text-sm font-semibold">Score moyen du groupe par compétence</Label>
            {COMPETENCES.map((comp) => (
              <div key={comp} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{comp}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs",
                      bilanScores[comp] >= 80 && "border-green-500/50 text-green-600",
                      bilanScores[comp] >= 60 && bilanScores[comp] < 80 && "border-orange-500/50 text-orange-600",
                      bilanScores[comp] < 60 && "border-red-500/50 text-red-600"
                    )}
                  >
                    {bilanScores[comp]}%
                  </Badge>
                </div>
                <Slider
                  value={[bilanScores[comp]]}
                  onValueChange={([v]) =>
                    setBilanScores((prev) => ({ ...prev, [comp]: v }))
                  }
                  min={0}
                  max={100}
                  step={5}
                  className="w-full"
                />
              </div>
            ))}
          </div>

          {/* Élèves en difficulté */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Élèves en difficulté
            </Label>
            {blockedStudents.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {blockedStudents.map((s, i) => (
                  <Badge key={i} variant="secondary" className="gap-1 pr-1">
                    {s.nom} ({s.competence})
                    <button
                      onClick={() => removeBlockedStudent(i)}
                      className="ml-1 rounded-full hover:bg-muted p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={newBlockedName}
                onChange={(e) => setNewBlockedName(e.target.value)}
                placeholder="Nom de l'élève"
                className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm flex-1"
                onKeyDown={(e) => e.key === "Enter" && addBlockedStudent()}
              />
              <select
                value={newBlockedCompetence}
                onChange={(e) => setNewBlockedCompetence(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                {COMPETENCES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <Button size="sm" variant="outline" onClick={addBlockedStudent}>
                Ajouter
              </Button>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Notes complémentaires</Label>
            <Textarea
              value={bilanNotes}
              onChange={(e) => setBilanNotes(e.target.value)}
              placeholder="Observations, points positifs, ajustements suggérés..."
              className="min-h-[80px]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Action bar */}
      <div className="flex gap-2 print:hidden">
        <Button onClick={handleValidate} className="flex-1" disabled={saving || adapting}>
          {saving || adapting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {adapting ? "Adaptation IA en cours..." : "Valider le bilan"}
        </Button>
        <Button variant="outline" onClick={handlePrint}>
          <Printer className="h-4 w-4 mr-2" />
          Imprimer
        </Button>
      </div>

      {nextSession && (
        <p className="text-xs text-muted-foreground text-center print:hidden">
          <Sparkles className="h-3 w-3 inline mr-1" />
          {isAutoAdapt
            ? `Pilote auto activé — La séance "${nextSession.titre}" sera adaptée automatiquement`
            : `L'IA proposera des suggestions pour adapter "${nextSession.titre}"`}
        </p>
      )}

      {/* Confirmation dialog for unchecked exercises */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exercices non traités</DialogTitle>
            <DialogDescription>
              {uncheckedExercises.length} exercice(s) n'ont pas été traité(s).
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
              Reporter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Adaptation result dialog */}
      <Dialog open={showAdaptation} onOpenChange={setShowAdaptation}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Adaptation IA — Séance N+1
            </DialogTitle>
            <DialogDescription>
              Suggestions basées sur le bilan d'aujourd'hui
            </DialogDescription>
          </DialogHeader>
          {adaptationResult && (
            <div className="space-y-4 py-2">
              <div>
                <Label className="text-xs text-muted-foreground">Focus compétence</Label>
                <Badge className="ml-2">{adaptationResult.competence_focus}</Badge>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Analyse</Label>
                <p className="text-sm mt-1">{adaptationResult.analyse_bilan}</p>
              </div>
              {adaptationResult.exercices_remediation?.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Exercices de remédiation suggérés
                  </Label>
                  <div className="space-y-2 mt-2">
                    {adaptationResult.exercices_remediation.map((ex: any, i: number) => (
                      <div key={i} className="p-3 rounded-md border bg-muted/30 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{ex.titre}</span>
                          <Badge variant="outline" className="text-[10px]">{ex.competence}</Badge>
                          <Badge variant="secondary" className="text-[10px]">{ex.format}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{ex.description}</p>
                        <span className="text-xs text-muted-foreground">~{ex.duree_minutes} min</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <Label className="text-xs text-muted-foreground">Objectifs ajustés</Label>
                <p className="text-sm mt-1">{adaptationResult.objectifs_ajustes}</p>
              </div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button onClick={applyAdaptation} disabled={saving} className="flex-1">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Appliquer les suggestions
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowAdaptation(false);
                navigate("/formateur/seances");
              }}
              className="flex-1"
            >
              Ignorer et continuer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
