import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  BookOpen,
  CheckCircle2,
  Clipboard,
  Database,
  FileText,
  Loader2,
  Search,
  Sparkles,
  Timer,
  Wand2,
} from "lucide-react";

type PedagogicalActivity = {
  id: string;
  activity_id: string;
  title: string;
  category: string;
  audience: string | null;
  level_min: string;
  level_max: string;
  objective: string;
  duration_min: number | null;
  duration_max: number | null;
  materials_needed: string[] | null;
  instructions: string;
  tags: string[] | null;
  document_id: string | null;
  source_pdf: string | null;
};

const LEVELS = ["Pré-A1", "A0", "A1", "A2", "B1", "B2", "C1", "C2"];

const CATEGORIES = [
  "compréhension orale",
  "compréhension écrite",
  "production orale",
  "production écrite",
  "grammaire",
  "lexique / structure",
  "vocabulaire",
  "jeux pédagogiques",
  "jeux de rôle / mises en situation",
  "interaction",
  "oral / conversation",
  "phonétique",
  "matériel pédagogique",
  "ressources polyvalentes",
];

const DEFAULT_QUERY = "présentation de soi oral interaction TCF";

function formatDuration(activity: PedagogicalActivity) {
  if (activity.duration_min == null && activity.duration_max == null) return "Durée non précisée";
  if (activity.duration_min === activity.duration_max) return `${activity.duration_min} min`;
  return `${activity.duration_min ?? "?"} à ${activity.duration_max ?? "?"} min`;
}

function shortText(value: string | null | undefined, max = 220) {
  if (!value) return "Non précisé";
  return value.length > max ? `${value.slice(0, max).trim()}...` : value;
}

function buildSessionBrief(params: {
  query: string;
  level: string;
  duration: string;
  category: string;
  selectedActivities: PedagogicalActivity[];
}) {
  const selected = params.selectedActivities
    .map(
      (activity, index) => `${index + 1}. ${activity.title}
- Catégorie : ${activity.category}
- Niveau : ${activity.level_min} à ${activity.level_max}
- Durée : ${formatDuration(activity)}
- Objectif : ${activity.objective}
- Consignes : ${activity.instructions}
- Matériel : ${(activity.materials_needed ?? []).join(", ") || "Non précisé"}
- Tags : ${(activity.tags ?? []).join(", ") || "Non précisé"}
- Source : ${activity.source_pdf ?? "Non précisé"} / ${activity.document_id ?? "Non précisé"}`,
    )
    .join("\n\n");

  return `Construis une séance pédagogique à partir des activités existantes ci-dessous.

Demande formateur : ${params.query || "Non précisée"}
Niveau cible : ${params.level === "all" ? "à déterminer" : params.level}
Durée cible : ${params.duration || "à déterminer"} minutes
Catégorie prioritaire : ${params.category === "all" ? "aucune" : params.category}

Règles :
- Ne pas inventer une activité si une activité fournie convient.
- Combiner 2 à 4 activités compatibles.
- Adapter le déroulé au niveau cible.
- Citer les sources PDF utilisées.
- Prévoir objectif, déroulé minute par minute, consignes formateur, matériel, différenciation et trace de fin.

Activités disponibles :

${selected}`;
}

export default function BanqueActivites() {
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [level, setLevel] = useState("A1");
  const [maxDuration, setMaxDuration] = useState("45");
  const [category, setCategory] = useState("all");
  const [limit, setLimit] = useState("12");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: totalCount = 0, isLoading: countLoading } = useQuery({
    queryKey: ["pedagogical-activities-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("pedagogical_activities")
        .select("*", { count: "exact", head: true });

      if (error) throw error;
      return count ?? 0;
    },
    retry: false,
  });

  const {
    data: activities = [],
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ["pedagogical-activity-search", query, level, maxDuration, category, limit],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("search_pedagogical_activities", {
        p_query: query.trim() || null,
        p_level: level === "all" ? null : level,
        p_category: category === "all" ? null : category,
        p_max_duration: maxDuration ? Number(maxDuration) : null,
        p_tags: null,
        p_limit: Number(limit),
      });

      if (error) throw error;
      return (data ?? []) as PedagogicalActivity[];
    },
    retry: false,
  });

  const selectedActivities = useMemo(
    () => activities.filter((activity) => selectedIds.has(activity.id)),
    [activities, selectedIds],
  );

  const brief = useMemo(
    () =>
      buildSessionBrief({
        query,
        level,
        duration: maxDuration,
        category,
        selectedActivities,
      }),
    [category, level, maxDuration, query, selectedActivities],
  );

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectFirstRelevant = () => {
    setSelectedIds(new Set(activities.slice(0, 4).map((activity) => activity.id)));
  };

  const copyBrief = async () => {
    if (selectedActivities.length === 0) {
      toast.error("Sélectionne au moins une activité.");
      return;
    }

    await navigator.clipboard.writeText(brief);
    toast.success("Brief copié pour la génération de séance.");
  };

  const hasMissingDatabase = error instanceof Error && /search_pedagogical_activities|pedagogical_activities/i.test(error.message);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Banque d'activités pédagogiques</h1>
          <p className="text-sm text-muted-foreground">
            Recherche dans les activités FLE / TCF avant de construire une séance.
          </p>
        </div>
        <Badge className="w-fit gap-1" variant={totalCount > 0 ? "default" : "outline"}>
          <Database className="h-3.5 w-3.5" />
          {countLoading ? "Base..." : `${totalCount} activités en base`}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Search className="h-5 w-5" />
            Demande formateur
          </CardTitle>
          <CardDescription>
            C'est ici que ton choix se fait : tu décris le besoin, l'app récupère les activités pertinentes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_140px_140px_220px_120px]">
            <div className="space-y-2">
              <Label htmlFor="query">Objectif ou thème</Label>
              <Input
                id="query"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ex. présentation de soi, prendre rendez-vous, expression orale..."
              />
            </div>

            <div className="space-y-2">
              <Label>Niveau</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  {LEVELS.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Durée max</Label>
              <Input
                id="duration"
                type="number"
                min={1}
                value={maxDuration}
                onChange={(event) => setMaxDuration(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Catégorie</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  {CATEGORIES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Résultats</Label>
              <Select value={limit} onValueChange={setLimit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="8">8</SelectItem>
                  <SelectItem value="12">12</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="40">40</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              Rechercher
            </Button>
            <Button variant="outline" onClick={selectFirstRelevant} disabled={activities.length === 0}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Sélectionner les 4 premiers
            </Button>
            <Button variant="ghost" onClick={() => setSelectedIds(new Set())} disabled={selectedIds.size === 0}>
              Vider la sélection
            </Button>
          </div>

          {hasMissingDatabase && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              La table ou la fonction de recherche n'est pas encore disponible côté Supabase. Applique les migrations puis lance les imports.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="h-5 w-5" />
              Activités proposées
            </CardTitle>
            <CardDescription>
              L'IA utilisera uniquement les activités que tu sélectionnes dans cette liste.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isFetching ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Recherche en cours
              </div>
            ) : activities.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-14 text-center text-muted-foreground">
                <Database className="mb-2 h-9 w-9" />
                <p>Aucune activité trouvée.</p>
                <p className="text-xs">Essaie une demande plus large ou vérifie que la base est importée.</p>
              </div>
            ) : (
              activities.map((activity) => {
                const selected = selectedIds.has(activity.id);
                return (
                  <div
                    key={activity.id}
                    className={`rounded-md border p-4 transition-colors ${
                      selected ? "border-primary bg-primary/5" : "bg-background"
                    }`}
                  >
                    <div className="flex gap-3">
                      <Checkbox checked={selected} onCheckedChange={() => toggleSelected(activity.id)} className="mt-1" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <h2 className="font-semibold leading-snug">{activity.title}</h2>
                            <p className="mt-1 text-sm text-muted-foreground">{shortText(activity.objective)}</p>
                          </div>
                          <Badge variant="outline">{activity.level_min} à {activity.level_max}</Badge>
                        </div>

                        <div className="flex flex-wrap gap-2 text-xs">
                          <Badge variant="secondary">{activity.category}</Badge>
                          <Badge variant="outline" className="gap-1">
                            <Timer className="h-3 w-3" />
                            {formatDuration(activity)}
                          </Badge>
                          {(activity.tags ?? []).slice(0, 4).map((tag) => (
                            <Badge key={tag} variant="outline" className="text-muted-foreground">
                              {tag}
                            </Badge>
                          ))}
                        </div>

                        <p className="text-sm leading-relaxed">{shortText(activity.instructions, 320)}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <FileText className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{activity.source_pdf ?? "Source non précisée"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5" />
              Brief de séance
            </CardTitle>
            <CardDescription>
              Ce bloc est le contexte à donner à la génération IA.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">{selectedActivities.length} activité(s) sélectionnée(s)</p>
                <p className="text-xs text-muted-foreground">Conseil : 2 à 4 activités pour une séance lisible.</p>
              </div>
              <Button size="sm" onClick={copyBrief} disabled={selectedActivities.length === 0}>
                <Clipboard className="mr-2 h-4 w-4" />
                Copier
              </Button>
            </div>

            <Separator />

            <Textarea
              value={selectedActivities.length === 0 ? "Sélectionne des activités pour générer le brief." : brief}
              readOnly
              rows={22}
              className="resize-none text-xs leading-relaxed"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
