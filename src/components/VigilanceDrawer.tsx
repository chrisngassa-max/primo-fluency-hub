import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Minus, Plus, Play, Download, Loader2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface VigilanceResource {
  id: string;
  titre: string;
  type: "Exercice en ligne" | "Activité imprimable" | "Jeu de rôle";
  source: "banque" | "banque_adapte" | "genere";
  quantity: number;
  checked: boolean;
  checkedDate?: string;
  exerciseData?: any;
}

interface VigilanceDrawerProps {
  pointVigilance: string;
  theme?: string;
  competence?: string;
  niveauDepart?: string;
  typeDemarche?: string;
  seanceId: string;
  seanceNotes: any;
  groupId: string;
  sessionId?: string | null;
}

const SOURCE_LABELS: Record<string, { label: string; className: string }> = {
  banque: { label: "Banque", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  banque_adapte: { label: "Adapté", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  genere: { label: "Généré", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
};

const TYPE_DEFAULTS: Record<string, number> = {
  "Exercice en ligne": 3,
  "Activité imprimable": 1,
  "Jeu de rôle": 2,
};

function mapExerciseToType(ex: any): "Exercice en ligne" | "Activité imprimable" | "Jeu de rôle" {
  const format = ex?.format || ex?.type || "";
  if (["production_orale", "oral", "EO"].includes(format)) return "Jeu de rôle";
  if (["production_ecrite"].includes(format)) return "Activité imprimable";
  return "Exercice en ligne";
}

export default function VigilanceDrawer({
  pointVigilance,
  theme,
  competence,
  niveauDepart,
  typeDemarche,
  seanceId,
  seanceNotes,
  groupId,
  sessionId,
}: VigilanceDrawerProps) {
  const [resources, setResources] = useState<VigilanceResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingMore, setGeneratingMore] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Load existing checked state from notes
  useEffect(() => {
    loadResources();
  }, []);

  const getExistingChecked = (): Record<string, string> => {
    try {
      const notes = typeof seanceNotes === "string" ? JSON.parse(seanceNotes) : seanceNotes;
      const faits = notes?.points_vigilance_faits || [];
      const match = faits.find((p: any) => p.texte === pointVigilance);
      if (match) {
        const map: Record<string, string> = {};
        (match.ressources_faites || []).forEach((r: string) => {
          map[r] = match.date || new Date().toISOString().slice(0, 10);
        });
        return map;
      }
    } catch {}
    return {};
  };

  const loadResources = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("tcf-generate-exercise", {
        body: {
          theme: theme || "Vie quotidienne en France",
          level: niveauDepart || "A1",
          type_demarche: typeDemarche || "titre_sejour",
          apprenant: {},
          dispositif: { point_vigilance: pointVigilance, count: 3 },
        },
      });

      if (error) throw error;

      const checkedMap = getExistingChecked();

      // The edge function returns a single exercise - we'll create 3 variants
      const exercises = Array.isArray(data) ? data : [data];
      
      // Generate 3 resources from the response
      const types: Array<"Exercice en ligne" | "Activité imprimable" | "Jeu de rôle"> = [
        "Exercice en ligne",
        "Activité imprimable", 
        "Jeu de rôle",
      ];

      const mapped: VigilanceResource[] = exercises.slice(0, 3).map((ex: any, i: number) => {
        const type = types[i] || mapExerciseToType(ex);
        const titre = ex?.titre || `Exercice ${competence || "TCF"} — ${theme || "IRN"}`;
        const key = `${titre} x${TYPE_DEFAULTS[type]}`;
        return {
          id: `res-${i}-${Date.now()}`,
          titre,
          type,
          source: ex?.source || "genere",
          quantity: TYPE_DEFAULTS[type],
          checked: !!checkedMap[key],
          checkedDate: checkedMap[key],
          exerciseData: ex,
        };
      });

      // If we only got 1 exercise, create 2 more variants
      while (mapped.length < 3) {
        const i = mapped.length;
        const type = types[i];
        const titre = i === 1
          ? `Activité — ${theme || "Situation quotidienne"}`
          : `Jeu de rôle — ${theme || "Mise en situation"}`;
        const key = `${titre} x${TYPE_DEFAULTS[type]}`;
        mapped.push({
          id: `res-${i}-${Date.now()}`,
          titre,
          type,
          source: "genere",
          quantity: TYPE_DEFAULTS[type],
          checked: !!checkedMap[key],
          checkedDate: checkedMap[key],
          exerciseData: exercises[0],
        });
      }

      setResources(mapped);
    } catch (err: any) {
      console.error("Vigilance resource generation error:", err);
      toast.error("Erreur de chargement des ressources");
      // Provide fallback resources
      setResources([
        { id: "fb-1", titre: `Exercice ${competence || "CO"} — ${theme || "IRN"}`, type: "Exercice en ligne", source: "genere", quantity: 3, checked: false, exerciseData: null },
        { id: "fb-2", titre: `Activité — ${theme || "Situation quotidienne"}`, type: "Activité imprimable", source: "genere", quantity: 1, checked: false, exerciseData: null },
        { id: "fb-3", titre: `Jeu de rôle — ${theme || "Mise en situation"}`, type: "Jeu de rôle", source: "genere", quantity: 2, checked: false, exerciseData: null },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = (id: string, delta: number) => {
    setResources((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, quantity: Math.max(1, Math.min(10, r.quantity + delta)) } : r
      )
    );
  };

  const toggleCheck = async (id: string) => {
    const updated = resources.map((r) =>
      r.id === id
        ? { ...r, checked: !r.checked, checkedDate: !r.checked ? new Date().toISOString().slice(0, 10) : undefined }
        : r
    );
    setResources(updated);

    // Save to parcours_seances.notes
    setSaving(true);
    try {
      const currentNotes = typeof seanceNotes === "string" ? JSON.parse(seanceNotes || "{}") : (seanceNotes || {});
      const faits = currentNotes.points_vigilance_faits || [];
      const existingIdx = faits.findIndex((p: any) => p.texte === pointVigilance);

      const ressourcesFaites = updated
        .filter((r) => r.checked)
        .map((r) => `${r.titre} x${r.quantity}`);

      const entry = {
        texte: pointVigilance,
        ressources_faites: ressourcesFaites,
        date: new Date().toISOString().slice(0, 10),
      };

      if (existingIdx >= 0) {
        faits[existingIdx] = entry;
      } else if (ressourcesFaites.length > 0) {
        faits.push(entry);
      }

      const newNotes = { ...currentNotes, points_vigilance_faits: faits };

      await supabase
        .from("parcours_seances")
        .update({ notes: JSON.stringify(newNotes) })
        .eq("id", seanceId);
    } catch (err) {
      console.error("Save vigilance state error:", err);
    } finally {
      setSaving(false);
    }
  };

  const handlePropose = async (resource: VigilanceResource) => {
    if (!sessionId) {
      toast.warning("Aucune séance créée. Préparez d'abord la séance.");
      return;
    }

    try {
      // Add exercise to session
      const { error } = await supabase.from("session_exercices").insert({
        session_id: sessionId,
        exercice_id: resource.exerciseData?.id || resource.id,
        ordre: 99,
      });

      if (error) {
        // If the exercise doesn't exist in DB, we can't link it
        toast.info("Exercice proposé — à générer via la préparation de séance");
      } else {
        toast.success("Exercice ajouté à la séance !");
      }
    } catch {
      toast.error("Erreur lors de l'ajout");
    }
  };

  const handleDownload = (resource: VigilanceResource) => {
    // Open print dialog with formatted content
    const content = resource.exerciseData;
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <html><head><title>${resource.titre}</title>
        <style>body{font-family:sans-serif;padding:2rem;max-width:800px;margin:0 auto}
        h1{font-size:1.5rem;color:#333}
        .consigne{background:#f5f5f5;padding:1rem;border-radius:8px;margin:1rem 0}
        </style></head>
        <body>
          <h1>${resource.titre}</h1>
          <div class="consigne">${content?.consigne || content?.contenu || pointVigilance}</div>
          <pre style="white-space:pre-wrap;font-size:0.9rem">${JSON.stringify(content?.contenu || content, null, 2)}</pre>
        </body></html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  if (loading) {
    return (
      <div className="space-y-2 pt-2 pb-1">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2 pt-2 pb-1">
      {resources.map((resource) => (
        <div
          key={resource.id}
          className={cn(
            "flex flex-wrap sm:flex-nowrap items-start sm:items-center gap-2 p-2.5 rounded-lg border text-xs transition-colors",
            resource.checked
              ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
              : "bg-background border-border"
          )}
        >
          {/* Checkbox */}
          <Checkbox
            checked={resource.checked}
            onCheckedChange={() => toggleCheck(resource.id)}
            className={cn("h-4 w-4 shrink-0", resource.checked && "data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600")}
          />

          {/* Title + type */}
          <div className="flex-1 min-w-0">
            <p className={cn("font-medium truncate", resource.checked && "line-through text-muted-foreground")}>
              {resource.titre}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {resource.type}
              </Badge>
              <Badge className={cn("text-[10px] px-1.5 py-0 border-0", SOURCE_LABELS[resource.source]?.className)}>
                {SOURCE_LABELS[resource.source]?.label}
              </Badge>
            </div>
            {resource.checked && resource.checkedDate && (
              <p className="text-[10px] text-green-600 dark:text-green-400 mt-0.5 flex items-center gap-1">
                <Check className="h-3 w-3" />
                Fait le {resource.checkedDate}
              </p>
            )}
          </div>

          {/* Quantity selector */}
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="outline"
              size="icon"
              className="h-6 w-6"
              onClick={() => updateQuantity(resource.id, -1)}
              disabled={resource.quantity <= 1}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <span className="w-5 text-center font-semibold text-xs">{resource.quantity}</span>
            <Button
              variant="outline"
              size="icon"
              className="h-6 w-6"
              onClick={() => updateQuantity(resource.id, 1)}
              disabled={resource.quantity >= 10}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>

          {/* Action button */}
          {resource.type === "Exercice en ligne" ? (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[10px] px-2 shrink-0"
              onClick={() => handlePropose(resource)}
            >
              <Play className="h-3 w-3 mr-1" />
              Proposer
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[10px] px-2 shrink-0"
              onClick={() => handleDownload(resource)}
            >
              <Download className="h-3 w-3 mr-1" />
              PDF
            </Button>
          )}
        </div>
      ))}
      {saving && (
        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" /> Sauvegarde...
        </p>
      )}
    </div>
  );
}
