import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Library, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { searchExerciseBank } from "@/lib/curriculum/exerciseLinks";
import type { ExerciseBankFilters, ExerciseBankPreview } from "@/lib/curriculum/types";

const NIVEAUX = ["A1", "A2", "B1", "B2"];
const COMPETENCES = ["CO", "CE", "EE", "EO", "Structures"];
const FORMATS = ["qcm", "vrai_faux", "texte_lacunaire", "appariement", "transformation", "production_ecrite", "production_orale"];

type ValidationPreset = "valides" | "tout_sauf_rejetes" | "tout";

const VALIDATION_PRESETS: Record<ValidationPreset, { label: string; statuses?: string[] }> = {
  valides: { label: "Validés (recommandé)", statuses: ["validated_auto", "approved_human"] },
  tout_sauf_rejetes: { label: "Tout sauf rejetés", statuses: ["draft", "validated_auto", "needs_review", "approved_human"] },
  tout: { label: "Tout (y compris rejetés)", statuses: undefined },
};

const VALIDATION_BADGE_CLASS: Record<string, string> = {
  validated_auto: "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300",
  approved_human: "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300",
  needs_review: "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300",
  rejected: "bg-red-50 text-red-700 border-red-300 dark:bg-red-950/40 dark:text-red-300",
  draft: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-900/40 dark:text-slate-300",
};

const ALL = "__all__";

interface ExerciseLibraryTabProps {
  onAdd: (exercise: ExerciseBankPreview) => void;
  busy: boolean;
  addedIds: Set<string>;
}

export function ExerciseLibraryTab({ onAdd, busy, addedIds }: ExerciseLibraryTabProps) {
  const [niveau, setNiveau] = useState("A2");
  const [competence, setCompetence] = useState<string>(ALL);
  const [format, setFormat] = useState<string>(ALL);
  const [theme, setTheme] = useState("");
  const [preset, setPreset] = useState<ValidationPreset>("valides");

  const filters: ExerciseBankFilters = {
    niveau_vise: niveau,
    competence: competence === ALL ? undefined : competence,
    format: format === ALL ? undefined : format,
    theme: theme.trim() || undefined,
    validation_status: VALIDATION_PRESETS[preset].statuses,
  };

  const { data: results, isLoading, error } = useQuery({
    queryKey: ["exercise-bank-search", filters],
    queryFn: () => searchExerciseBank(filters),
  });

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Recherche dans la banque partagée uniquement (jamais les devoirs ou copies d'élèves). Ajouter un
        exercice crée un lien vers la séance ; l'exercice lui-même n'est ni dupliqué ni modifié.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Niveau</Label>
          <Select value={niveau} onValueChange={setNiveau}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {NIVEAUX.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Compétence</Label>
          <Select value={competence} onValueChange={setCompetence}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Toutes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Toutes</SelectItem>
              {COMPETENCES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Format</Label>
          <Select value={format} onValueChange={setFormat}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Tous" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous</SelectItem>
              {FORMATS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Thème</Label>
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="ex : identité" className="h-9 pl-8" />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Validation</Label>
          <Select value={preset} onValueChange={(v) => setPreset(v as ValidationPreset)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.entries(VALIDATION_PRESETS) as [ValidationPreset, { label: string }][]).map(([key, v]) => (
                <SelectItem key={key} value={key}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive">Erreur de recherche ({(error as Error).message}).</p>
      ) : isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : !results || results.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Aucun exercice ne correspond à ces filtres.</p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{results.length} exercice{results.length > 1 ? "s" : ""}</p>
          {results.map((ex) => {
            const alreadyAdded = addedIds.has(ex.id);
            return (
              <Card key={ex.id}>
                <CardContent className="py-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <Library className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                      <span className="text-sm font-medium truncate">{ex.titre}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="outline" className="text-[10px]">{ex.niveau_vise}</Badge>
                      <Badge variant="outline" className="text-[10px]">{ex.competence}</Badge>
                      <Badge variant="outline" className="text-[10px]">{ex.format}</Badge>
                      {ex.theme && <Badge variant="outline" className="text-[10px]">{ex.theme}</Badge>}
                      <Badge className={cn("text-[10px] border", VALIDATION_BADGE_CLASS[ex.validation_status] ?? "")} variant="outline">
                        {ex.validation_status}
                      </Badge>
                      {ex.validation_score != null && (
                        <Badge variant="outline" className="text-[10px]">Score {ex.validation_score}</Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="h-8 gap-1.5 text-xs shrink-0"
                    disabled={busy || alreadyAdded}
                    onClick={() => onAdd(ex)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {alreadyAdded ? "Déjà dans la séance" : "Ajouter à la séance"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
