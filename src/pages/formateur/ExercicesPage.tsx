import { useState, useMemo, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import {
  BookOpen, Printer, Search, Eye, Volume2, Circle, Filter, Drama, Package, MessageCircle, Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const COMPETENCES = ["CO", "CE", "EE", "EO", "Structures"] as const;
const NIVEAUX = ["A0", "A1", "A2", "B1", "B2", "C1"] as const;

const competenceColor: Record<string, string> = {
  CO: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  CE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  EE: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  EO: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  Structures: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
};

const ExercicesPage = () => {
  const { user } = useAuth();
  const [filterCompetence, setFilterCompetence] = useState<string>("all");
  const [filterNiveau, setFilterNiveau] = useState<string>("all");
  const [filterSession, setFilterSession] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewExercise, setPreviewExercise] = useState<any>(null);
  const [animationGuide, setAnimationGuide] = useState<any>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // Fetch all exercises for this formateur
  const { data: exercices, isLoading } = useQuery({
    queryKey: ["formateur-all-exercices", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercices")
        .select("id, titre, consigne, competence, format, contenu, difficulte, niveau_vise, created_at, is_ai_generated")
        .eq("formateur_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  // Fetch session_exercices to know which exercise belongs to which session
  const { data: sessionExLinks } = useQuery({
    queryKey: ["formateur-session-exercice-links", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("session_exercices")
        .select("exercice_id, session_id, session:sessions(id, titre, date_seance)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  // Build session list for filter
  const sessionOptions = useMemo(() => {
    if (!sessionExLinks) return [];
    const map = new Map<string, string>();
    sessionExLinks.forEach((link: any) => {
      const s = link.session;
      if (s && !map.has(s.id)) {
        map.set(s.id, s.titre || `Séance du ${new Date(s.date_seance).toLocaleDateString("fr-FR")}`);
      }
    });
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [sessionExLinks]);

  // Map exercise -> session ids
  const exerciseSessionMap = useMemo(() => {
    if (!sessionExLinks) return new Map<string, string[]>();
    const m = new Map<string, string[]>();
    sessionExLinks.forEach((link: any) => {
      const arr = m.get(link.exercice_id) || [];
      arr.push(link.session_id);
      m.set(link.exercice_id, arr);
    });
    return m;
  }, [sessionExLinks]);

  // Filter exercises
  const filtered = useMemo(() => {
    if (!exercices) return [];
    return exercices.filter((ex) => {
      if (filterCompetence !== "all" && ex.competence !== filterCompetence) return false;
      if (filterNiveau !== "all" && ex.niveau_vise !== filterNiveau) return false;
      if (filterSession !== "all") {
        const sessions = exerciseSessionMap.get(ex.id) || [];
        if (!sessions.includes(filterSession)) return false;
      }
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        if (!ex.titre.toLowerCase().includes(s) && !ex.consigne.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [exercices, filterCompetence, filterNiveau, filterSession, searchTerm, exerciseSessionMap]);

  // Group by competence
  const grouped = useMemo(() => {
    const g: Record<string, any[]> = {};
    filtered.forEach((ex) => {
      const key = ex.competence || "Autre";
      if (!g[key]) g[key] = [];
      g[key].push(ex);
    });
    return g;
  }, [filtered]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((e) => e.id)));
    }
  };

  const handlePrintSelection = () => {
    if (selected.size === 0) return;
    // Build print content
    const selectedExercises = (exercices ?? []).filter((e) => selected.has(e.id));
    const printWindow = window.open("", "_blank");
    if (!printWindow) { toast.error("Pop-up bloqué. Autorisez les pop-ups."); return; }

    const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><title>Exercices — TCF Pro</title>
<style>
body { font-family: 'Segoe UI', sans-serif; padding: 24px; font-size: 13pt; color: #222; }
h1 { font-size: 18pt; border-bottom: 2px solid #333; padding-bottom: 8px; margin-bottom: 20px; }
.exercise { page-break-inside: avoid; margin-bottom: 28px; border: 1px solid #ddd; border-radius: 8px; padding: 16px; }
.exercise h2 { font-size: 14pt; margin: 0 0 4px; }
.exercise .meta { font-size: 10pt; color: #666; margin-bottom: 8px; }
.exercise .consigne { font-style: italic; margin-bottom: 12px; font-size: 12pt; }
.question { margin-bottom: 14px; }
.question p { font-weight: 600; margin-bottom: 6px; }
.option { padding: 4px 0 4px 20px; position: relative; }
.option::before { content: "☐"; position: absolute; left: 0; }
.write-zone { border: 1px dashed #aaa; height: 60px; border-radius: 4px; margin-top: 6px; }
@media print { body { padding: 0; } .exercise { border: 1px solid #ccc; } }
</style></head><body>
<h1>📝 Exercices sélectionnés — ${selectedExercises.length} exercice(s)</h1>
<p style="font-size:10pt;color:#666;">Imprimé le ${new Date().toLocaleDateString("fr-FR")} — TCF Pro</p>
${selectedExercises.map((ex, i) => {
  const contenu = typeof ex.contenu === "object" && ex.contenu !== null ? ex.contenu : { items: [] };
  const items: any[] = Array.isArray((contenu as any).items) ? (contenu as any).items : [];
  return `<div class="exercise">
<h2>${i + 1}. ${ex.titre}</h2>
<div class="meta">${ex.competence} · ${ex.format?.replace(/_/g, " ")} · Niveau ${ex.niveau_vise} · Difficulté ${ex.difficulte}/5</div>
<div class="consigne">${ex.consigne}</div>
${items.map((item: any, qi: number) => `<div class="question">
<p>Q${qi + 1}. ${item.question || ""}</p>
${Array.isArray(item.options) && item.options.length > 0
  ? item.options.map((o: string) => `<div class="option">${o}</div>`).join("")
  : '<div class="write-zone"></div>'}
</div>`).join("")}
</div>`;
}).join("")}
</body></html>`;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  };

  const handlePrintSingle = (ex: any) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) { toast.error("Pop-up bloqué."); return; }
    const contenu = typeof ex.contenu === "object" && ex.contenu !== null ? ex.contenu : { items: [] };
    const items: any[] = Array.isArray((contenu as any).items) ? (contenu as any).items : [];
    const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><title>${ex.titre} — TCF Pro</title>
<style>
body { font-family: 'Segoe UI', sans-serif; padding: 24px; font-size: 13pt; color: #222; }
h1 { font-size: 16pt; margin-bottom: 4px; }
.meta { font-size: 10pt; color: #666; margin-bottom: 12px; }
.consigne { font-style: italic; margin-bottom: 16px; }
.question { margin-bottom: 14px; }
.question p { font-weight: 600; margin-bottom: 6px; }
.option { padding: 4px 0 4px 20px; position: relative; }
.option::before { content: "☐"; position: absolute; left: 0; }
.write-zone { border: 1px dashed #aaa; height: 60px; border-radius: 4px; margin-top: 6px; }
</style></head><body>
<h1>${ex.titre}</h1>
<div class="meta">${ex.competence} · ${ex.format?.replace(/_/g, " ")} · Niveau ${ex.niveau_vise}</div>
<div class="consigne">${ex.consigne}</div>
${items.map((item: any, qi: number) => `<div class="question">
<p>Q${qi + 1}. ${item.question || ""}</p>
${Array.isArray(item.options) && item.options.length > 0
  ? item.options.map((o: string) => `<div class="option">${o}</div>`).join("")
  : '<div class="write-zone"></div>'}
</div>`).join("")}
</body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 w-full" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Exercices</h1>
        <p className="text-sm text-muted-foreground">
          {exercices?.length || 0} exercice(s) au total · {filtered.length} affiché(s)
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Filtres</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Recherche</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9 h-9" placeholder="Titre ou consigne…"
                  value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Compétence</Label>
              <Select value={filterCompetence} onValueChange={setFilterCompetence}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  {COMPETENCES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Niveau</Label>
              <Select value={filterNiveau} onValueChange={setFilterNiveau}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  {NIVEAUX.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Séance</Label>
              <Select value={filterSession} onValueChange={setFilterSession}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  {sessionOptions.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selection bar */}
      <div className="flex items-center justify-between">
        <button onClick={toggleAll} className="text-xs text-primary hover:underline">
          {selected.size === filtered.length && filtered.length > 0 ? "Tout désélectionner" : "Tout sélectionner"}
        </button>
        <span className="text-xs text-muted-foreground">{selected.size} sélectionné(s)</span>
      </div>

      {/* Exercise list grouped by competence */}
      {Object.keys(grouped).length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <BookOpen className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground font-medium">Aucun exercice trouvé</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Modifiez vos filtres ou générez des exercices depuis une séance.
            </p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([comp, exs]) => (
          <div key={comp} className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge className={cn("text-xs", competenceColor[comp] || "bg-muted text-muted-foreground")}>
                {comp}
              </Badge>
              <span className="text-xs text-muted-foreground">{exs.length} exercice(s)</span>
            </div>
            <Accordion type="multiple" className="space-y-1">
              {exs.map((ex: any) => {
                const isSelected = selected.has(ex.id);
                const contenu = typeof ex.contenu === "object" && ex.contenu !== null ? ex.contenu : { items: [] };
                const items: any[] = Array.isArray((contenu as any).items) ? (contenu as any).items : [];

                return (
                  <AccordionItem key={ex.id} value={ex.id} className={cn(
                    "border rounded-lg transition-all",
                    isSelected && "border-primary/40 bg-primary/5"
                  )}>
                    <div className="flex items-center gap-3 px-4 py-3">
                      <Checkbox checked={isSelected} onCheckedChange={() => toggle(ex.id)} className="h-5 w-5" />
                      <AccordionTrigger className="flex-1 min-w-0 py-0 hover:no-underline">
                        <div className="flex items-center gap-2 flex-wrap text-left">
                          <h3 className="font-semibold text-sm">{ex.titre}</h3>
                          <Badge variant="outline" className="text-[10px]">{ex.format?.replace(/_/g, " ")}</Badge>
                          <Badge variant="secondary" className="text-[10px]">Niv. {ex.niveau_vise}</Badge>
                          <span className="text-[10px] text-muted-foreground">{items.length} Q</span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-semibold">
                            <Circle className="h-2 w-2 fill-emerald-500 text-emerald-500" />En ligne
                          </span>
                        </div>
                      </AccordionTrigger>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="outline" size="icon" className="h-8 w-8"
                          onClick={(e) => { e.stopPropagation(); setPreviewExercise(ex); }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" className="h-8 w-8"
                          onClick={(e) => { e.stopPropagation(); handlePrintSingle(ex); }}>
                          <Printer className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <AccordionContent className="px-4 pb-4 pt-0">
                      <div className="space-y-3 border-t pt-3">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-1">Consigne</p>
                          <p className="text-sm">{ex.consigne}</p>
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-xs">
                          <div><span className="text-muted-foreground">Niveau</span><p className="font-medium">{ex.niveau_vise}</p></div>
                          <div><span className="text-muted-foreground">Difficulté</span><p className="font-medium">{ex.difficulte}/5</p></div>
                          <div><span className="text-muted-foreground">Questions</span><p className="font-medium">{items.length}</p></div>
                        </div>
                        {items.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs font-semibold text-muted-foreground">Aperçu ({items.length} items)</p>
                            {items.slice(0, 3).map((item: any, idx: number) => (
                              <div key={idx} className="text-xs p-2 rounded-md bg-muted/50 border">
                                <span className="font-semibold text-primary">Q{idx + 1}.</span>{" "}
                                <span>{item.question}</span>
                              </div>
                            ))}
                            {items.length > 3 && <p className="text-[11px] text-muted-foreground">+ {items.length - 3} autre(s)…</p>}
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        ))
      )}

      {/* Floating print button */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 right-6 z-50">
          <Button size="lg" onClick={handlePrintSelection} className="gap-2 shadow-lg">
            <Printer className="h-5 w-5" />
            Imprimer la sélection ({selected.size})
          </Button>
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={!!previewExercise} onOpenChange={(open) => { if (!open) setPreviewExercise(null); }}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              Aperçu Élève — {previewExercise?.titre}
            </DialogTitle>
            <DialogDescription>Exercice tel que l'élève le verra.</DialogDescription>
          </DialogHeader>
          {previewExercise && (() => {
            const pc = typeof previewExercise.contenu === "object" && previewExercise.contenu !== null
              ? previewExercise.contenu : { items: [] };
            const pitems: any[] = Array.isArray((pc as any).items) ? (pc as any).items : [];
            return (
              <div className="space-y-5 pt-2">
                <Card><CardHeader className="pb-2">
                  <CardTitle className="text-base">Consigne</CardTitle>
                  <p className="text-sm text-muted-foreground">{previewExercise.consigne}</p>
                </CardHeader></Card>
                <div className="flex gap-2 flex-wrap">
                  <Badge>{previewExercise.competence}</Badge>
                  <Badge variant="outline">{previewExercise.format?.replace(/_/g, " ")}</Badge>
                  <Badge variant="secondary">Niveau {previewExercise.niveau_vise}</Badge>
                </div>
                {pitems.length > 0 ? (
                  <div className="space-y-4">
                    {pitems.map((item: any, idx: number) => (
                      <Card key={idx}><CardContent className="pt-4 space-y-3">
                        <p className="font-medium text-sm">
                          <span className="text-primary font-bold mr-2">Q{idx + 1}.</span>{item.question}
                        </p>
                        {previewExercise.competence === "CO" && (
                          <Button variant="outline" size="sm" className="gap-2" disabled>
                            <Volume2 className="h-4 w-4" />Écouter l'audio
                          </Button>
                        )}
                        {Array.isArray(item.options) && item.options.length > 0 ? (
                          <RadioGroup disabled className="space-y-1">
                            {item.options.map((opt: string, oi: number) => (
                              <div key={oi} className="flex items-center space-x-2 p-2 rounded-lg bg-muted/30 border">
                                <RadioGroupItem value={opt} id={`pv-q${idx}-o${oi}`} disabled />
                                <Label htmlFor={`pv-q${idx}-o${oi}`} className="cursor-default flex-1 text-sm">{opt}</Label>
                              </div>
                            ))}
                          </RadioGroup>
                        ) : (
                          <div className="border rounded-md p-3 bg-muted/20 text-sm text-muted-foreground italic">
                            Zone de saisie libre
                          </div>
                        )}
                      </CardContent></Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground text-sm">Aucune question.</div>
                )}
                <Button variant="outline" className="w-full" disabled>Soumettre mes réponses</Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ExercicesPage;
