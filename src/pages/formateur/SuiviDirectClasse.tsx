import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  HandHelping,
  Lightbulb,
  Search,
  Activity,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  mockLiveStudents,
  mockGroupes,
  mockLecons,
  mockTempsMoyenClasseS,
  ALERT_THRESHOLDS,
  classifyAdaptive,
  type LiveStudent,
  type AdaptiveBadge,
} from "@/data/mockLiveClass";
import AdaptiveProposalDialog, {
  type AdaptiveMode,
} from "@/components/AdaptiveProposalDialog";

type StatusKind = "success" | "warning" | "danger";

function getStatusBadge(taux: number): { label: string; kind: StatusKind } {
  if (taux >= 75) return { label: "En réussite", kind: "success" };
  if (taux >= 50) return { label: "À encourager", kind: "warning" };
  return { label: "Besoin d'aide", kind: "danger" };
}

function badgeClasses(kind: StatusKind) {
  switch (kind) {
    case "success":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
    case "warning":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30";
    case "danger":
      return "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30";
  }
}

function adaptiveBadge(b: AdaptiveBadge) {
  switch (b) {
    case "challenger":
      return {
        label: "À challenger",
        cls: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
      };
    case "aider":
      return {
        label: "À aider",
        cls: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
      };
    default:
      return {
        label: "Stable",
        cls: "bg-muted text-muted-foreground border-border",
      };
  }
}

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function isAlert(s: LiveStudent) {
  return (
    s.tentatives_question > ALERT_THRESHOLDS.ECHECS_QUESTION ||
    s.temps_inactif_s > ALERT_THRESHOLDS.INACTIVITE_S
  );
}

const SuiviDirectClasse = () => {
  const [groupe, setGroupe] = useState<string>("all");
  const [lecon, setLecon] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogStudent, setDialogStudent] = useState<LiveStudent | null>(null);
  const [dialogMode, setDialogMode] = useState<AdaptiveMode>("same");

  const filtered = useMemo(() => {
    return mockLiveStudents.filter((s) => {
      if (groupe !== "all" && s.groupe !== groupe) return false;
      if (lecon !== "all" && s.lecon !== lecon) return false;
      if (search && !s.nom.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [groupe, lecon, search]);

  const alertes = useMemo(() => filtered.filter(isAlert), [filtered]);
  const counts = useMemo(() => {
    const c = { challenger: 0, aider: 0, stable: 0 };
    filtered.forEach((s) => {
      c[classifyAdaptive(s)]++;
    });
    return c;
  }, [filtered]);

  const openProposal = (s: LiveStudent, mode: AdaptiveMode) => {
    setDialogStudent(s);
    setDialogMode(mode);
    setDialogOpen(true);
  };

  const handleAider = (s: LiveStudent) => {
    toast.success(`Aide envoyée à ${s.nom}`, {
      description: `Sur ${s.exercice} — ${s.question_actuelle}`,
    });
  };

  const handleIndice = (s: LiveStudent) => {
    toast.success(`Indice envoyé à ${s.nom}`, {
      description: s.question_actuelle,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Activity className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Suivi en direct de la classe</h1>
          <p className="text-sm text-muted-foreground">
            Pilotage adaptatif : challenger les rapides, aider ceux qui bloquent.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        {/* Sidebar filtres */}
        <aside className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Filtres</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Groupe</label>
                <Select value={groupe} onValueChange={setGroupe}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les groupes</SelectItem>
                    {mockGroupes.map((g) => (
                      <SelectItem key={g} value={g}>
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Leçon</label>
                <Select value={lecon} onValueChange={setLecon}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les leçons</SelectItem>
                    {mockLecons.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Recherche</label>
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Nom de l'élève…"
                    className="pl-8"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Pilotage adaptatif</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">À challenger</span>
                <Badge variant="outline" className={adaptiveBadge("challenger").cls}>
                  {counts.challenger}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">À aider</span>
                <Badge variant="outline" className={adaptiveBadge("aider").cls}>
                  {counts.aider}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Stable</span>
                <Badge variant="outline" className={adaptiveBadge("stable").cls}>
                  {counts.stable}
                </Badge>
              </div>
              <div className="pt-2 mt-2 border-t text-xs text-muted-foreground">
                Temps moyen classe : {Math.round(mockTempsMoyenClasseS / 60)} min
              </div>
            </CardContent>
          </Card>
        </aside>

        {/* Main */}
        <div className="space-y-6 min-w-0">
          {/* Alertes prioritaires */}
          <Card className="border-red-500/30">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                Alertes prioritaires
                <Badge variant="outline" className="ml-1">
                  {alertes.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {alertes.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Aucune alerte. Tous les élèves progressent normalement. 🎉
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Élève</TableHead>
                        <TableHead>Exercice</TableHead>
                        <TableHead>Question</TableHead>
                        <TableHead className="text-center">Échecs</TableHead>
                        <TableHead>Dernière erreur</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {alertes.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">{s.nom}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {s.exercice}
                          </TableCell>
                          <TableCell className="text-sm">{s.question_actuelle}</TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className={
                                s.tentatives_question > ALERT_THRESHOLDS.ECHECS_QUESTION
                                  ? badgeClasses("danger")
                                  : ""
                              }
                            >
                              {s.tentatives_question}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {s.derniere_erreur ?? "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" onClick={() => handleAider(s)}>
                              Aider
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Grille cartes élèves */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Élèves en cours</h2>
            {filtered.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  Aucun élève ne correspond aux filtres.
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map((s) => {
                  const status = getStatusBadge(s.taux_reussite);
                  const alert = isAlert(s);
                  const adapt = classifyAdaptive(s);
                  const adaptMeta = adaptiveBadge(adapt);
                  return (
                    <Card
                      key={s.id}
                      className={alert ? "border-red-500/40 shadow-sm" : ""}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start gap-3">
                          <Avatar>
                            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                              {initials(s.nom)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <CardTitle className="text-base truncate">{s.nom}</CardTitle>
                              <Badge
                                variant="outline"
                                className={badgeClasses(status.kind)}
                              >
                                {status.label}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {s.groupe} · {s.lecon}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                              <Badge variant="outline" className={adaptMeta.cls}>
                                <Sparkles className="h-3 w-3 mr-1" />
                                {adaptMeta.label}
                              </Badge>
                              {s.termine && (
                                <Badge
                                  variant="outline"
                                  className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                >
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Terminé
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Exercice en cours</p>
                          <p className="text-sm font-medium truncate">
                            {s.exercice}{" "}
                            <span className="text-xs text-muted-foreground font-normal">
                              · {s.competence} · niveau {s.difficulte}/5
                            </span>
                          </p>
                        </div>

                        <div>
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <span className="text-muted-foreground">Progression</span>
                            <span className="font-semibold">{s.progression}%</span>
                          </div>
                          <Progress value={s.progression} className="h-2" />
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="rounded-md border bg-muted/30 px-2 py-1.5">
                            <p className="text-muted-foreground">Tentatives</p>
                            <p
                              className={`font-semibold text-sm ${
                                s.tentatives_question > ALERT_THRESHOLDS.ECHECS_QUESTION
                                  ? "text-red-600 dark:text-red-400"
                                  : ""
                              }`}
                            >
                              {s.tentatives_question}
                            </p>
                          </div>
                          <div className="rounded-md border bg-muted/30 px-2 py-1.5">
                            <p className="text-muted-foreground">Inactif</p>
                            <p
                              className={`font-semibold text-sm ${
                                s.temps_inactif_s > ALERT_THRESHOLDS.INACTIVITE_S
                                  ? "text-red-600 dark:text-red-400"
                                  : ""
                              }`}
                            >
                              {s.temps_inactif_s}s
                            </p>
                          </div>
                          <div className="rounded-md border bg-muted/30 px-2 py-1.5">
                            <p className="text-muted-foreground">Temps total</p>
                            <p className="font-semibold text-sm">
                              {s.termine ? `${Math.round(s.temps_total_s / 60)}m` : "—"}
                            </p>
                          </div>
                        </div>

                        {alert && (
                          <div className="rounded-md border border-red-500/30 bg-red-500/5 p-2 text-xs">
                            <p className="font-medium text-red-700 dark:text-red-300 flex items-center gap-1">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              Intervention recommandée
                            </p>
                            {s.derniere_erreur && (
                              <p className="text-muted-foreground mt-0.5">
                                {s.derniere_erreur}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Actions classiques */}
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            className="flex-1"
                            onClick={() => handleAider(s)}
                          >
                            <HandHelping className="h-4 w-4" />
                            Aider
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => handleIndice(s)}
                          >
                            <Lightbulb className="h-4 w-4" />
                            Indice
                          </Button>
                        </div>

                        {/* Actions adaptatives */}
                        <div className="border-t pt-3">
                          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                            <Sparkles className="h-3 w-3" />
                            Proposer un nouvel exercice
                          </p>
                          <div className="grid grid-cols-3 gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openProposal(s, "harder")}
                              className="text-xs px-2"
                            >
                              <TrendingUp className="h-3.5 w-3.5" />
                              Plus dur
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openProposal(s, "easier")}
                              className="text-xs px-2"
                            >
                              <TrendingDown className="h-3.5 w-3.5" />
                              Plus facile
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openProposal(s, "same")}
                              className="text-xs px-2"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              Même
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <AdaptiveProposalDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        student={dialogStudent}
        mode={dialogMode}
      />
    </div>
  );
};

export default SuiviDirectClasse;
