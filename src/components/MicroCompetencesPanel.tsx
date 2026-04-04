import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GripVertical, Flame, X, Plus, Save, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { COMPETENCE_COLORS } from "@/lib/competences";

// ─── Default micro-competencies per global competency ───
const DEFAULT_MICRO_COMPETENCES: Record<string, string[]> = {
  CO: [
    "Identifier une heure ou un horaire",
    "Comprendre un message vocal court",
    "Repérer un lieu dans une consigne orale",
    "Comprendre un numéro de téléphone épelé",
    "Identifier une information administrative dans un audio",
  ],
  CE: [
    "Lire et comprendre un panneau simple",
    "Identifier des horaires sur une affiche",
    "Comprendre un SMS court",
    "Lire un formulaire administratif simple",
    "Repérer une information dans un email court",
    "Comprendre une étiquette ou une notice",
  ],
  EO: [
    "Se présenter (prénom, âge, nationalité)",
    "Donner une adresse ou un numéro",
    "Décrire une image simple",
    "Simuler un appel pour un rendez-vous",
    "Expliquer un problème simple à l'oral",
  ],
  EE: [
    "Compléter un formulaire simple",
    "Écrire un SMS court",
    "Rédiger une phrase de présentation",
    "Répondre à une question par écrit en une phrase",
    "Écrire une liste (courses, documents à apporter)",
  ],
};

export interface MicroCompetence {
  texte: string;
  statut: "normal" | "a_renforcer";
  competence_globale: string;
}

interface MicroCompetencesPanelProps {
  sessionId: string | null;
  competencesCibles: string[];
  formateurId: string;
  onConfigChange?: (config: MicroCompetence[]) => void;
}

const MicroCompetencesPanel = ({
  sessionId,
  competencesCibles,
  formateurId,
  onConfigChange,
}: MicroCompetencesPanelProps) => {
  const [items, setItems] = useState<MicroCompetence[]>([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newText, setNewText] = useState("");
  const [newComp, setNewComp] = useState("");
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  // Build default list from competences_cibles
  const buildDefaults = useCallback((): MicroCompetence[] => {
    const result: MicroCompetence[] = [];
    for (const comp of competencesCibles) {
      const micros = DEFAULT_MICRO_COMPETENCES[comp] || [];
      for (const texte of micros) {
        result.push({ texte, statut: "normal", competence_globale: comp });
      }
    }
    return result;
  }, [competencesCibles]);

  // Load saved config or defaults
  useEffect(() => {
    if (!sessionId || !formateurId || competencesCibles.length === 0) {
      setItems([]);
      setLoaded(true);
      return;
    }

    const load = async () => {
      const { data } = await supabase
        .from("formateur_competences_config")
        .select("competences_ordonnees")
        .eq("seance_id", sessionId)
        .eq("formateur_id", formateurId)
        .maybeSingle();

      if (data?.competences_ordonnees && Array.isArray(data.competences_ordonnees) && data.competences_ordonnees.length > 0) {
        setItems(data.competences_ordonnees as unknown as MicroCompetence[]);
      } else {
        setItems(buildDefaults());
      }
      setLoaded(true);
    };
    load();
  }, [sessionId, formateurId, competencesCibles, buildDefaults]);

  // Notify parent on changes
  useEffect(() => {
    if (loaded) onConfigChange?.(items);
  }, [items, loaded]);

  // ─── Drag & Drop (native HTML5) ───
  const handleDragStart = (index: number) => {
    dragItem.current = index;
  };

  const handleDragEnter = (index: number) => {
    dragOverItem.current = index;
  };

  const handleDragEnd = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    const copy = [...items];
    const [removed] = copy.splice(dragItem.current, 1);
    copy.splice(dragOverItem.current, 0, removed);
    setItems(copy);
    dragItem.current = null;
    dragOverItem.current = null;
  };

  // ─── Toggle "à renforcer" ───
  const toggleRenforcer = (index: number) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? { ...item, statut: item.statut === "a_renforcer" ? "normal" : "a_renforcer" }
          : item
      )
    );
  };

  // ─── Remove ───
  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
    toast.info("Micro-compétence supprimée");
  };

  // ─── Add ───
  const handleAdd = () => {
    if (!newText.trim()) return;
    const comp = newComp || competencesCibles[0] || "CO";
    setItems((prev) => [...prev, { texte: newText.trim(), statut: "normal", competence_globale: comp }]);
    setNewText("");
    setShowAddForm(false);
    toast.success("Micro-compétence ajoutée");
  };

  // ─── Save ───
  const handleSave = async () => {
    if (!sessionId || !formateurId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("formateur_competences_config")
        .upsert(
          {
            seance_id: sessionId,
            formateur_id: formateurId,
            competences_ordonnees: items as any,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "seance_id,formateur_id" }
        );
      if (error) throw error;
      toast.success("Configuration des micro-compétences enregistrée !");
    } catch (e: any) {
      toast.error("Erreur de sauvegarde", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  if (!sessionId || competencesCibles.length === 0) return null;

  // Group items by competence_globale for display
  const grouped = competencesCibles.reduce<Record<string, { items: (MicroCompetence & { globalIndex: number })[] }>>((acc, comp) => {
    acc[comp] = { items: [] };
    return acc;
  }, {});
  items.forEach((item, index) => {
    if (grouped[item.competence_globale]) {
      grouped[item.competence_globale].items.push({ ...item, globalIndex: index });
    }
  });

  const renforcerCount = items.filter((i) => i.statut === "a_renforcer").length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            🎯 Micro-compétences ciblées
            {renforcerCount > 0 && (
              <Badge variant="destructive" className="text-[10px] h-5 px-1.5">
                {renforcerCount} à renforcer
              </Badge>
            )}
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-xs"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Enregistrer cet ordre
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {competencesCibles.map((comp) => {
          const group = grouped[comp];
          if (!group || group.items.length === 0) return null;
          return (
            <div key={comp} className="space-y-1.5">
              <div className="flex items-center gap-2 mb-1">
                <Badge className={`text-[11px] ${COMPETENCE_COLORS[comp] || "bg-muted text-muted-foreground"}`}>
                  {comp}
                </Badge>
                <span className="text-xs text-muted-foreground font-medium">
                  {comp === "CO" && "Compréhension Orale"}
                  {comp === "CE" && "Compréhension Écrite"}
                  {comp === "EO" && "Expression Orale"}
                  {comp === "EE" && "Expression Écrite"}
                  {comp === "Structures" && "Structures"}
                </span>
              </div>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <div
                    key={item.globalIndex}
                    draggable
                    onDragStart={() => handleDragStart(item.globalIndex)}
                    onDragEnter={() => handleDragEnter(item.globalIndex)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => e.preventDefault()}
                    className={`flex items-center gap-2 p-2 rounded-lg border cursor-grab active:cursor-grabbing transition-colors ${
                      item.statut === "a_renforcer"
                        ? "border-orange-300 bg-orange-50 dark:border-orange-700 dark:bg-orange-950/20"
                        : "border-border bg-card hover:bg-muted/30"
                    }`}
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span
                      className={`flex-1 text-sm ${
                        item.statut === "a_renforcer"
                          ? "font-bold text-orange-700 dark:text-orange-400"
                          : "text-foreground"
                      }`}
                    >
                      {item.texte}
                    </span>
                    <button
                      onClick={() => toggleRenforcer(item.globalIndex)}
                      className={`p-1 rounded-md transition-colors ${
                        item.statut === "a_renforcer"
                          ? "text-orange-600 bg-orange-100 dark:bg-orange-900/40 dark:text-orange-400"
                          : "text-muted-foreground hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950/20"
                      }`}
                      title={item.statut === "a_renforcer" ? "Retirer le renforcement" : "Marquer à renforcer"}
                    >
                      <Flame className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => removeItem(item.globalIndex)}
                      className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title="Supprimer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Add form */}
        {showAddForm ? (
          <div className="flex items-center gap-2 pt-1">
            {competencesCibles.length > 1 && (
              <Select value={newComp || competencesCibles[0]} onValueChange={setNewComp}>
                <SelectTrigger className="w-[90px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {competencesCibles.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Input
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              placeholder="Ex : Comprendre un prix affiché"
              className="h-8 text-sm flex-1"
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              autoFocus
            />
            <Button size="sm" className="h-8 text-xs" onClick={handleAdd} disabled={!newText.trim()}>
              Ajouter
            </Button>
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setShowAddForm(false); setNewText(""); }}>
              Annuler
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs text-muted-foreground w-full justify-start"
            onClick={() => { setShowAddForm(true); setNewComp(competencesCibles[0] || ""); }}
          >
            <Plus className="h-3.5 w-3.5" /> Ajouter une micro-compétence
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default MicroCompetencesPanel;
