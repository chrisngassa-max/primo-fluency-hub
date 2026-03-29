import { useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  Clock,
  Target,
  ShoppingCart,
  Printer,
  CheckSquare,
  Gamepad2,
  BookOpen,
  Send,
  Eye,
  EyeOff,
  ClipboardList,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SessionExercice {
  titre: string;
  consigne: string;
  format: string;
  competence: string;
  difficulte: number;
  contenu: any;
  atelier_ludique: {
    scenario: string;
    jeu: string;
    materiel: string;
    objectif_oral: string;
    duree_minutes?: number;
    variante?: string;
  };
}

interface SessionInfo {
  titre: string;
  objectifs?: string;
  competences_cibles: string[];
  duree_minutes: number;
  niveau_cible: string;
  exercices_suggeres?: string[];
  source: "import" | "parcours";
  groupId?: string;
}

const competenceColors: Record<string, string> = {
  CO: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  CE: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  EE: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  EO: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  Structures: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
};

const formatLabels: Record<string, string> = {
  qcm: "QCM",
  vrai_faux: "Vrai/Faux",
  texte_lacunaire: "Texte lacunaire",
  appariement: "Appariement",
  transformation: "Transformation",
};

const SessionSupermarket = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const sessionInfo = location.state as SessionInfo | null;

  const [generating, setGenerating] = useState(false);
  const [exercices, setExercices] = useState<SessionExercice[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [dispatching, setDispatching] = useState(false);
  const [targetSessionId, setTargetSessionId] = useState("");
  const [showAteliers, setShowAteliers] = useState(true);
  const [gabaritIgnored, setGabaritIgnored] = useState(false);

  // Fetch today's sessions for dispatch target
  const { data: todaySessions } = useQuery({
    queryKey: ["formateur-today-sessions"],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data, error } = await supabase
        .from("sessions")
        .select("id, titre, date_seance, group_id, groups(nom)")
        .gte("date_seance", today.toISOString())
        .lt("date_seance", tomorrow.toISOString())
        .order("date_seance");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  // Also fetch all upcoming sessions
  const { data: upcomingSessions } = useQuery({
    queryKey: ["formateur-upcoming-sessions-dispatch"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("id, titre, date_seance, group_id, groups(nom)")
        .gte("date_seance", new Date().toISOString())
        .order("date_seance")
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  // Fetch first point_a_maitriser for linking exercises
  const { data: defaultPoint } = useQuery({
    queryKey: ["default-point-a-maitriser"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("points_a_maitriser")
        .select("id")
        .limit(1)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Auto-detect matching gabarit from session title
  const { data: detectedGabarit } = useQuery({
    queryKey: ["detected-gabarit", sessionInfo?.titre],
    queryFn: async () => {
      if (!sessionInfo?.titre) return null;
      // Try exact-ish match via ilike
      const words = sessionInfo.titre.split(/\s+/).filter(w => w.length > 3).slice(0, 3);
      if (words.length === 0) return null;
      
      // Try matching with the longest keyword
      const keyword = words.reduce((a, b) => a.length > b.length ? a : b);
      const { data, error } = await supabase
        .from("gabarits_pedagogiques")
        .select("*")
        .ilike("titre", `%${keyword}%`)
        .limit(1)
        .maybeSingle();
      if (error) {
        console.error("Gabarit search error:", error);
        return null;
      }
      return data;
    },
    enabled: !!sessionInfo?.titre,
  });

  const handleGenerate = async () => {
    if (!sessionInfo) return;
    setGenerating(true);
    setExercices([]);
    setSelected(new Set());
    try {
      const useGabarit = detectedGabarit && !gabaritIgnored;
      const body: any = {
        titre: sessionInfo.titre,
        objectifs: sessionInfo.objectifs,
        competences_cibles: sessionInfo.competences_cibles,
        niveau_cible: sessionInfo.niveau_cible,
        duree_minutes: sessionInfo.duree_minutes,
        exercices_suggeres: sessionInfo.exercices_suggeres,
      };
      if (useGabarit) {
        body.gabaritNumero = detectedGabarit.numero;
      }
      const { data, error } = await supabase.functions.invoke("generate-session-content", { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const exs = data.exercices || [];
      setExercices(exs);
      setSelected(new Set(exs.map((_: any, i: number) => i)));
      toast.success(`${exs.length} exercices + ateliers générés !${useGabarit ? " (gabarit appliqué)" : ""}`);
    } catch (e: any) {
      console.error(e);
      toast.error("Erreur de génération", { description: e.message });
    } finally {
      setGenerating(false);
    }
  };

  const toggleSelect = (index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === exercices.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(exercices.map((_, i) => i)));
    }
  };

  const selectedExercices = useMemo(
    () => exercices.filter((_, i) => selected.has(i)),
    [exercices, selected]
  );

  const handleDispatch = async () => {
    if (!targetSessionId || selectedExercices.length === 0) {
      toast.error("Sélectionnez une séance cible et au moins un exercice.");
      return;
    }
    if (!defaultPoint) {
      toast.error("Aucun point à maîtriser trouvé dans la base.");
      return;
    }

    setDispatching(true);
    try {
      // Insert exercises into exercices table
      const exercicesToInsert = selectedExercices.map((ex) => ({
        formateur_id: user!.id,
        titre: ex.titre,
        consigne: ex.consigne,
        format: ex.format as any,
        competence: ex.competence as any,
        difficulte: ex.difficulte,
        niveau_vise: sessionInfo?.niveau_cible || "A1",
        contenu: ex.contenu,
        animation_guide: ex.atelier_ludique,
        point_a_maitriser_id: defaultPoint.id,
        is_ai_generated: true,
        collectif: true,
        mode: "les_deux" as const,
      }));

      const { data: inserted, error: insErr } = await supabase
        .from("exercices")
        .insert(exercicesToInsert)
        .select("id");
      if (insErr) throw insErr;

      // Link to session via session_exercices
      const sessionExercicesToInsert = (inserted || []).map((ex, i) => ({
        session_id: targetSessionId,
        exercice_id: ex.id,
        ordre: i + 1,
        statut: "planifie" as const,
      }));

      const { error: linkErr } = await supabase
        .from("session_exercices")
        .insert(sessionExercicesToInsert);
      if (linkErr) throw linkErr;

      qc.invalidateQueries({ queryKey: ["formateur-sessions"] });
      toast.success(`${selectedExercices.length} exercices ajoutés à la séance !`);
      navigate("/formateur/seances");
    } catch (e: any) {
      console.error(e);
      toast.error("Erreur", { description: e.message });
    } finally {
      setDispatching(false);
    }
  };

  const handlePrint = () => {
    if (selectedExercices.length === 0) {
      toast.error("Sélectionnez au moins un exercice.");
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${sessionInfo?.titre || "Fiche exercices"}</title>
<style>
body { font-family: Arial, sans-serif; margin: 2cm; font-size: 14px; color: #333; }
h1 { font-size: 20px; border-bottom: 2px solid #333; padding-bottom: 8px; }
.exercise { page-break-inside: avoid; margin-bottom: 24px; border: 1px solid #ddd; padding: 16px; border-radius: 8px; }
.exercise h2 { font-size: 16px; margin: 0 0 4px 0; }
.badge { display: inline-block; background: #eee; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-right: 4px; }
.consigne { font-style: italic; margin: 8px 0; }
.item { margin: 8px 0 8px 16px; }
.options { margin-left: 16px; }
.option { margin: 2px 0; }
.write-zone { border: 1px dashed #ccc; min-height: 60px; margin-top: 8px; border-radius: 4px; }
@media print { body { margin: 1cm; } }
</style></head><body>
<h1>${sessionInfo?.titre || "Exercices"}</h1>
<p style="color:#666;font-size:12px;">Niveau : ${sessionInfo?.niveau_cible || ""} · ${selectedExercices.length} exercices · ${sessionInfo?.duree_minutes || 0} min</p>
${selectedExercices
  .map(
    (ex, i) => `
<div class="exercise">
  <h2>${i + 1}. ${ex.titre}</h2>
  <span class="badge">${ex.competence}</span>
  <span class="badge">${formatLabels[ex.format] || ex.format}</span>
  <p class="consigne">${ex.consigne}</p>
  ${(ex.contenu?.items || [])
    .map(
      (item: any, j: number) => `
    <div class="item">
      <strong>${j + 1}.</strong> ${item.question}
      ${
        item.options?.length
          ? `<div class="options">${item.options.map((o: string) => `<div class="option">☐ ${o}</div>`).join("")}</div>`
          : '<div class="write-zone"></div>'
      }
    </div>`
    )
    .join("")}
</div>`
  )
  .join("")}
</body></html>`;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  if (!sessionInfo) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Constructeur de Séance</h1>
            <p className="text-sm text-muted-foreground">Aucune séance sélectionnée</p>
          </div>
        </div>
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <ShoppingCart className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">
              Accédez à cette page depuis un plan de formation ou un programme importé
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const allSessions = upcomingSessions || [];

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-28">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 text-primary" />
            {sessionInfo.titre}
          </h1>
          <p className="text-sm text-muted-foreground">
            {sessionInfo.niveau_cible} · {sessionInfo.duree_minutes} min ·{" "}
            {sessionInfo.competences_cibles.join(", ")}
          </p>
        </div>
      </div>

      {/* Session info */}
      <Card>
        <CardContent className="py-4 px-5">
          <div className="space-y-2">
            {sessionInfo.objectifs && (
              <p className="text-sm"><strong>Objectifs :</strong> {sessionInfo.objectifs}</p>
            )}
            <div className="flex gap-2 flex-wrap">
              {sessionInfo.competences_cibles.map((c) => (
                <Badge key={c} className={competenceColors[c] || ""}>{c}</Badge>
              ))}
              <Badge variant="outline" className="gap-1">
                <Clock className="h-3 w-3" /> {sessionInfo.duree_minutes} min
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Target className="h-3 w-3" /> {sessionInfo.niveau_cible}
              </Badge>
            </div>
            {sessionInfo.exercices_suggeres && sessionInfo.exercices_suggeres.length > 0 && (
              <div className="flex gap-1 flex-wrap mt-1">
                <span className="text-xs text-muted-foreground mr-1">Suggestions :</span>
                {sessionInfo.exercices_suggeres.map((ex, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px]">{ex}</Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Gabarit detection + Generate button */}
      {exercices.length === 0 && !generating && (
        <div className="space-y-3">
          {detectedGabarit && !gabaritIgnored && (
            <Card className="border-primary/40 bg-primary/5">
              <CardContent className="py-4 px-5 space-y-2">
                <div className="flex items-start gap-3">
                  <ClipboardList className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-semibold">
                      📋 Gabarit détecté : Séance {detectedGabarit.numero} — {detectedGabarit.titre}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {detectedGabarit.palier_cecrl && `Palier ${detectedGabarit.palier_cecrl}`}
                      {detectedGabarit.competences_cibles?.length > 0 && ` · ${detectedGabarit.competences_cibles.join(", ")}`}
                    </p>
                    {detectedGabarit.lexique_cibles?.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Lexique :</span>{" "}
                        {detectedGabarit.lexique_cibles.slice(0, 8).join(", ")}
                        {detectedGabarit.lexique_cibles.length > 8 && "…"}
                      </p>
                    )}
                    {detectedGabarit.objectif_principal && (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Objectif :</span> {detectedGabarit.objectif_principal}
                      </p>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" className="shrink-0 h-7 w-7" onClick={() => setGabaritIgnored(true)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button onClick={handleGenerate} className="flex-1" data-gabarit={detectedGabarit.numero}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Générer selon ce gabarit
                  </Button>
                  <Button variant="outline" onClick={() => setGabaritIgnored(true)}>
                    Ignorer le gabarit
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          {(!detectedGabarit || gabaritIgnored) && (
            <Button onClick={handleGenerate} size="lg" className="w-full">
              <Sparkles className="h-4 w-4 mr-2" />
              Générer les exercices et ateliers ludiques
            </Button>
          )}
        </div>
      )}

      {generating && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-8 text-center">
            <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary mb-3" />
            <p className="font-medium">L'IA génère le contenu de la séance...</p>
            <p className="text-sm text-muted-foreground mt-1">
              Exercices numériques + ateliers ludiques pour {sessionInfo.duree_minutes} min
            </p>
          </CardContent>
        </Card>
      )}

      {/* Exercises + workshops list */}
      {exercices.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {exercices.length} paires exercice + atelier
            </h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowAteliers(!showAteliers)}>
                {showAteliers ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                {showAteliers ? "Masquer ateliers" : "Voir ateliers"}
              </Button>
              <Button variant="outline" size="sm" onClick={toggleAll}>
                <CheckSquare className="h-4 w-4 mr-1" />
                {selected.size === exercices.length ? "Tout désélectionner" : "Tout sélectionner"}
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {exercices.map((ex, i) => (
              <Card
                key={i}
                className={cn(
                  "transition-all cursor-pointer",
                  selected.has(i) && "ring-2 ring-primary/50 bg-primary/5"
                )}
                onClick={() => toggleSelect(i)}
              >
                <CardContent className="py-4 px-5">
                  <div className="flex gap-3">
                    <div className="pt-0.5">
                      <Checkbox
                        checked={selected.has(i)}
                        onCheckedChange={() => toggleSelect(i)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="flex-1 space-y-3">
                      {/* Exercise part */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <BookOpen className="h-4 w-4 text-primary" />
                          <span className="font-semibold text-sm">{ex.titre}</span>
                          <Badge className={`text-[10px] ${competenceColors[ex.competence] || ""}`}>
                            {ex.competence}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {formatLabels[ex.format] || ex.format}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            Diff. {ex.difficulte}/10
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground italic">{ex.consigne}</p>
                        <div className="text-xs text-muted-foreground">
                          {ex.contenu?.items?.length || 0} item(s)
                        </div>
                      </div>

                      {/* Workshop part */}
                      {showAteliers && ex.atelier_ludique && (
                        <div className="border-t pt-3 space-y-1.5">
                          <div className="flex items-center gap-2 text-sm font-medium text-orange-600 dark:text-orange-400">
                            <Gamepad2 className="h-4 w-4" />
                            Atelier ludique (formateur uniquement)
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                            <div className="p-2 rounded bg-muted/50">
                              <span className="font-semibold">🎭 Scénario :</span>{" "}
                              {ex.atelier_ludique.scenario}
                            </div>
                            <div className="p-2 rounded bg-muted/50">
                              <span className="font-semibold">🎲 Jeu :</span>{" "}
                              {ex.atelier_ludique.jeu}
                            </div>
                            <div className="p-2 rounded bg-muted/50">
                              <span className="font-semibold">📦 Matériel :</span>{" "}
                              {ex.atelier_ludique.materiel}
                            </div>
                            <div className="p-2 rounded bg-muted/50">
                              <span className="font-semibold">🗣️ Objectif oral :</span>{" "}
                              {ex.atelier_ludique.objectif_oral}
                            </div>
                          </div>
                          {ex.atelier_ludique.variante && (
                            <p className="text-xs text-muted-foreground">
                              💡 Variante : {ex.atelier_ludique.variante}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Floating dispatch bar */}
      {exercices.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur-sm shadow-lg">
          <div className="max-w-4xl mx-auto flex items-center gap-3 px-6 py-3">
            <div className="text-sm font-medium shrink-0">
              <Badge variant="default" className="mr-1">{selected.size}</Badge>
              sélectionné(s)
            </div>
            <Select value={targetSessionId} onValueChange={setTargetSessionId}>
              <SelectTrigger className="flex-1 max-w-xs">
                <SelectValue placeholder="Séance cible..." />
              </SelectTrigger>
              <SelectContent>
                {todaySessions && todaySessions.length > 0 && (
                  <>
                    <SelectItem value="__header_today" disabled>— Aujourd'hui —</SelectItem>
                    {todaySessions.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.titre} {s.groups?.nom ? `(${s.groups.nom})` : ""}
                      </SelectItem>
                    ))}
                  </>
                )}
                {allSessions.filter((s: any) => !todaySessions?.some((t: any) => t.id === s.id)).length > 0 && (
                  <>
                    <SelectItem value="__header_upcoming" disabled>— Prochaines —</SelectItem>
                    {allSessions
                      .filter((s: any) => !todaySessions?.some((t: any) => t.id === s.id))
                      .map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.titre} — {new Date(s.date_seance).toLocaleDateString("fr-FR")}
                        </SelectItem>
                      ))}
                  </>
                )}
              </SelectContent>
            </Select>
            <Button
              onClick={handleDispatch}
              disabled={dispatching || selected.size === 0 || !targetSessionId}
            >
              {dispatching ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Ajouter à la séance
            </Button>
            <Button variant="outline" onClick={handlePrint} disabled={selected.size === 0}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimer PDF
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionSupermarket;
