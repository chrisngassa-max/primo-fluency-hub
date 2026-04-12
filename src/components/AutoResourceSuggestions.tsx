import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  BookOpen, FileText, Brain, Eye, Sparkles, Loader2, Check, X, ChevronDown, ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AutoResourceSuggestionsProps {
  sessionId: string;
  session: {
    id: string;
    titre: string;
    objectifs: string | null;
    niveau_cible: string;
  };
  exercises: Array<{
    id: string;
    exercice: {
      id: string;
      titre: string;
      consigne: string;
      competence: string;
      format: string;
      contenu: any;
    } | null;
    statut: string;
  }>;
  checkedExercises: Record<string, boolean>;
}

interface GeneratedResource {
  titre: string;
  sections: Array<{ titre: string; contenu: string; type: string; items?: any[] }>;
  resume: string;
}

interface ResourceSuggestion {
  type: "lecon" | "vocabulaire" | "rappel_methodo" | "rappel_visuel";
  competence: string;
  niveau: string;
  label: string;
  context: string;
  exerciseContext?: any;
  generated?: GeneratedResource;
  saved?: boolean;
  generating?: boolean;
}

const typeIcons: Record<string, React.ElementType> = {
  lecon: BookOpen,
  vocabulaire: FileText,
  rappel_methodo: Brain,
  rappel_visuel: Eye,
};

const typeLabels: Record<string, string> = {
  lecon: "Leçon",
  vocabulaire: "Vocabulaire",
  rappel_methodo: "Rappel méthodo",
  rappel_visuel: "Rappel visuel",
};

/**
 * Part 1 of the Resource Bank: auto-generates resource suggestions
 * on session load and detects repeated competency patterns to suggest bilans.
 */
const AutoResourceSuggestions: React.FC<AutoResourceSuggestionsProps> = ({
  sessionId,
  session,
  exercises,
  checkedExercises,
}) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [suggestions, setSuggestions] = useState<ResourceSuggestion[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [previewResource, setPreviewResource] = useState<ResourceSuggestion | null>(null);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);

  // Track contextual bilan suggestions
  const [bilanSuggestion, setBilanSuggestion] = useState<{
    competence: string;
    count: number;
    dismissed: boolean;
  } | null>(null);

  // ─── Auto-generate on session load ───
  const generateSuggestions = useCallback(async () => {
    if (!user || exercises.length === 0 || generated) return;
    setGenerating(true);
    setGenerated(true);

    try {
      // Analyze exercises to determine key topics and competences
      const exsByCompetence = new Map<string, any[]>();
      exercises.forEach((se) => {
        if (!se.exercice) return;
        const comp = se.exercice.competence;
        if (!exsByCompetence.has(comp)) exsByCompetence.set(comp, []);
        exsByCompetence.get(comp)!.push(se.exercice);
      });

      // Generate 3-5 suggestions based on covered competences
      const newSuggestions: ResourceSuggestion[] = [];
      const competences = Array.from(exsByCompetence.keys());

      for (const comp of competences) {
        const exs = exsByCompetence.get(comp)!;
        // One vocab resource per competence
        newSuggestions.push({
          type: "vocabulaire",
          competence: comp,
          niveau: session.niveau_cible,
          label: `Vocabulaire ${comp}`,
          context: `Basé sur ${exs.length} exercice(s) de ${comp}`,
          exerciseContext: {
            titre: exs[0].titre,
            consigne: exs[0].consigne,
            competence: comp,
            format: exs[0].format,
          },
        });

        // One methodological reminder for the first competence
        if (newSuggestions.length <= 3) {
          newSuggestions.push({
            type: "rappel_methodo",
            competence: comp,
            niveau: session.niveau_cible,
            label: `Méthode ${comp}`,
            context: `Stratégie pour réussir les exercices de ${comp}`,
            exerciseContext: {
              titre: exs[0].titre,
              consigne: exs[0].consigne,
              competence: comp,
              format: exs[0].format,
            },
          });
        }
      }

      // Add a lesson for the dominant competence
      if (competences.length > 0) {
        const dominantComp = competences.reduce((a, b) =>
          (exsByCompetence.get(a)?.length ?? 0) >= (exsByCompetence.get(b)?.length ?? 0) ? a : b
        );
        const dominantExs = exsByCompetence.get(dominantComp)!;
        newSuggestions.push({
          type: "lecon",
          competence: dominantComp,
          niveau: session.niveau_cible,
          label: `Leçon ${dominantComp}`,
          context: `Notion principale de la séance (${dominantExs.length} exercices)`,
          exerciseContext: {
            titre: dominantExs[0].titre,
            consigne: dominantExs[0].consigne,
            competence: dominantComp,
            format: dominantExs[0].format,
          },
        });
      }

      // Limit to 5
      setSuggestions(newSuggestions.slice(0, 5));
    } catch (e) {
      console.error("Auto-suggestion error:", e);
    } finally {
      setGenerating(false);
    }
  }, [user, exercises, generated, session]);

  useEffect(() => {
    if (exercises.length > 0 && !generated) {
      generateSuggestions();
    }
  }, [exercises, generated, generateSuggestions]);

  // ─── Contextual bilan detection: after 3+ checked exercises on same competence ───
  const prevCheckedRef = useRef<number>(0);
  useEffect(() => {
    const checkedIds = Object.entries(checkedExercises)
      .filter(([, v]) => v)
      .map(([k]) => k);

    if (checkedIds.length < 3 || checkedIds.length <= prevCheckedRef.current) {
      prevCheckedRef.current = checkedIds.length;
      return;
    }
    prevCheckedRef.current = checkedIds.length;

    // Count checked exercises by competence
    const compCounts = new Map<string, number>();
    exercises.forEach((se) => {
      if (checkedExercises[se.id] && se.exercice) {
        const c = se.exercice.competence;
        compCounts.set(c, (compCounts.get(c) ?? 0) + 1);
      }
    });

    // If 3+ on same competence, suggest a bilan
    for (const [comp, count] of compCounts) {
      if (count >= 3 && (!bilanSuggestion || bilanSuggestion.competence !== comp || bilanSuggestion.dismissed)) {
        setBilanSuggestion({ competence: comp, count, dismissed: false });
        break;
      }
    }
  }, [checkedExercises, exercises, bilanSuggestion]);

  // ─── Generate a single resource ───
  const handleGenerate = async (index: number) => {
    const s = suggestions[index];
    if (!s || s.generating || s.generated) return;

    setSuggestions((prev) =>
      prev.map((item, i) => (i === index ? { ...item, generating: true } : item))
    );

    try {
      const { data, error } = await supabase.functions.invoke("generate-resource", {
        body: {
          type: s.type,
          competence: s.competence,
          niveau: s.niveau,
          exerciseContext: s.exerciseContext,
          sessionContext: {
            titre: session.titre,
            objectifs: session.objectifs,
            niveau_cible: session.niveau_cible,
          },
          mode: "auto",
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const resource = data.resource as GeneratedResource;
      setSuggestions((prev) =>
        prev.map((item, i) =>
          i === index ? { ...item, generating: false, generated: resource } : item
        )
      );
      toast.success(`Ressource "${resource.titre}" générée !`);
    } catch (e: any) {
      toast.error("Erreur de génération", { description: e.message });
      setSuggestions((prev) =>
        prev.map((item, i) => (i === index ? { ...item, generating: false } : item))
      );
    }
  };

  // ─── Save resource to DB ───
  const handleSave = async (index: number) => {
    const s = suggestions[index];
    if (!s?.generated || !user) return;
    setSavingIndex(index);

    try {
      const { error } = await supabase.from("ressources_pedagogiques").insert({
        formateur_id: user.id,
        session_id: sessionId,
        type: s.type as any,
        competence: s.competence as any,
        niveau: s.niveau,
        titre: s.generated.titre,
        contenu: s.generated as any,
        source: "auto" as any,
        statut: "draft" as any,
      });
      if (error) throw error;

      setSuggestions((prev) =>
        prev.map((item, i) => (i === index ? { ...item, saved: true } : item))
      );
      qc.invalidateQueries({ queryKey: ["ressources-pedagogiques"] });
      toast.success("Ressource sauvegardée dans la banque !");
    } catch (e: any) {
      toast.error("Erreur de sauvegarde", { description: e.message });
    } finally {
      setSavingIndex(null);
    }
  };

  // ─── Generate bilan resource ───
  const handleGenerateBilan = async () => {
    if (!bilanSuggestion || !user) return;
    const comp = bilanSuggestion.competence;

    setBilanSuggestion((prev) => prev ? { ...prev, dismissed: true } : null);

    try {
      const checkedExs = exercises
        .filter((se) => checkedExercises[se.id] && se.exercice?.competence === comp)
        .map((se) => se.exercice!);

      const { data, error } = await supabase.functions.invoke("generate-resource", {
        body: {
          type: "rappel_methodo",
          competence: comp,
          niveau: session.niveau_cible,
          exerciseContext: {
            titre: checkedExs.map((e) => e.titre).join(" / "),
            consigne: checkedExs[0]?.consigne || "",
            competence: comp,
            format: checkedExs[0]?.format || "qcm",
          },
          sessionContext: {
            titre: session.titre,
            objectifs: session.objectifs,
            niveau_cible: session.niveau_cible,
          },
          mode: "bilan",
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const resource = data.resource as GeneratedResource;

      // Auto-save
      await supabase.from("ressources_pedagogiques").insert({
        formateur_id: user.id,
        session_id: sessionId,
        type: "rappel_methodo" as any,
        competence: comp as any,
        niveau: session.niveau_cible,
        titre: resource.titre,
        contenu: resource as any,
        source: "auto" as any,
        statut: "draft" as any,
      });

      qc.invalidateQueries({ queryKey: ["ressources-pedagogiques"] });
      toast.success(`Bilan intermédiaire "${resource.titre}" généré et sauvegardé !`);
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    }
  };

  if (suggestions.length === 0 && !generating && !bilanSuggestion) return null;

  return (
    <>
      {/* ─── Contextual bilan notification ─── */}
      {bilanSuggestion && !bilanSuggestion.dismissed && (
        <Card className="border-primary/30 bg-primary/5 print:hidden animate-in fade-in slide-in-from-top-2 duration-300">
          <CardContent className="py-3 px-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Sparkles className="h-5 w-5 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  Bilan suggéré sur {bilanSuggestion.competence}
                </p>
                <p className="text-xs text-muted-foreground">
                  {bilanSuggestion.count} exercices traités sur cette compétence — générer une ressource de rappel ?
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setBilanSuggestion((prev) => prev ? { ...prev, dismissed: true } : null)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" onClick={handleGenerateBilan}>
                <Sparkles className="h-3.5 w-3.5 mr-1" />
                Générer
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Auto-generated resource suggestions ─── */}
      <Card className="print:hidden">
        <CardHeader
          className="pb-2 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Ressources anticipées
              <Badge variant="secondary" className="text-xs">
                {suggestions.length}
              </Badge>
            </CardTitle>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Ressources générées par l'IA à partir des exercices prévus
          </p>
        </CardHeader>

        {expanded && (
          <CardContent className="pt-0 space-y-2">
            {generating && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyse des exercices…
              </div>
            )}

            {suggestions.map((s, i) => {
              const Icon = typeIcons[s.type] || FileText;
              return (
                <div
                  key={i}
                  className="flex items-center justify-between gap-3 p-2.5 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{s.label}</span>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {s.competence}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{s.context}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {s.saved ? (
                      <Badge variant="default" className="text-xs gap-1">
                        <Check className="h-3 w-3" /> Sauvé
                      </Badge>
                    ) : s.generated ? (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => setPreviewResource(s)}
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          Voir
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleSave(i)}
                          disabled={savingIndex === i}
                        >
                          {savingIndex === i ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <>
                              <Check className="h-3.5 w-3.5 mr-1" />
                              Sauver
                            </>
                          )}
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => handleGenerate(i)}
                        disabled={s.generating}
                      >
                        {s.generating ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <>
                            <Sparkles className="h-3.5 w-3.5 mr-1" />
                            Générer
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        )}
      </Card>

      {/* ─── Preview dialog ─── */}
      <Dialog open={!!previewResource} onOpenChange={(o) => !o && setPreviewResource(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{previewResource?.generated?.titre}</DialogTitle>
            <DialogDescription>
              {typeLabels[previewResource?.type || "lecon"]} · {previewResource?.competence} · {previewResource?.niveau}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {previewResource?.generated?.sections.map((section, i) => (
              <div key={i} className={cn(
                "rounded-lg p-4",
                section.type === "encadre" && "bg-primary/5 border border-primary/20",
                section.type === "attention" && "bg-destructive/5 border border-destructive/20",
                section.type === "astuce" && "bg-green-50 border border-green-200 dark:bg-green-950/30 dark:border-green-800",
                section.type === "exemple" && "bg-blue-50 border border-blue-200 dark:bg-blue-950/30 dark:border-blue-800",
                !["encadre", "attention", "astuce", "exemple"].includes(section.type) && "bg-muted/30",
              )}>
                <h4 className="font-semibold text-sm mb-2">{section.titre}</h4>
                <div className="text-sm whitespace-pre-line">{section.contenu}</div>
                {section.items && section.items.length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {section.items.map((item: any, j: number) => (
                      <li key={j} className="text-sm">
                        <span className="font-medium">{item.terme}</span>
                        {item.definition && <span className="text-muted-foreground"> — {item.definition}</span>}
                        {item.exemple && <span className="text-xs text-muted-foreground italic block ml-4">Ex: {item.exemple}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}

            {previewResource?.generated?.resume && (
              <p className="text-sm text-muted-foreground italic border-t pt-3">
                {previewResource.generated.resume}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AutoResourceSuggestions;
