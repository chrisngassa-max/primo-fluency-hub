import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  BookOpen, CheckCircle2, Clock, Square, Send, Loader2, Filter,
  TrendingUp, TrendingDown, Minus, Radio, Circle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type DifficultyChoice = "same" | "harder" | "much_harder";

const DevoirsFormateur = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [resendDevoir, setResendDevoir] = useState<any>(null);
  const [difficultyChoice, setDifficultyChoice] = useState<DifficultyChoice>("same");
  const [resending, setResending] = useState(false);
  const [activeTab, setActiveTab] = useState("historique");

  // Realtime: subscribe to devoirs + resultats changes
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel("devoirs-live-" + user.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "devoirs" }, () => {
        qc.invalidateQueries({ queryKey: ["devoirs-formateur-all", user.id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "resultats" }, () => {
        qc.invalidateQueries({ queryKey: ["devoirs-resultats"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, qc]);
  // Fetch all devoirs for this formateur with related data
  const { data: devoirs, isLoading } = useQuery({
    queryKey: ["devoirs-formateur-all", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("devoirs")
        .select("*, exercice:exercices(id, titre, competence, format, difficulte, consigne, contenu, niveau_vise, formateur_id, point_a_maitriser_id), eleve:profiles!devoirs_eleve_id_fkey(id, prenom, nom)")
        .eq("formateur_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Fetch results for devoirs
  const devoirIds = useMemo(() => (devoirs || []).map((d: any) => d.id), [devoirs]);
  const { data: resultats } = useQuery({
    queryKey: ["devoirs-resultats", devoirIds],
    queryFn: async () => {
      if (devoirIds.length === 0) return [];
      const { data, error } = await supabase
        .from("resultats")
        .select("*")
        .in("devoir_id", devoirIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: devoirIds.length > 0,
  });

  // Compute average time from all results for reference
  const avgTimeMs = useMemo(() => {
    if (!resultats || resultats.length === 0) return 0;
    const withTime = resultats.filter((r: any) => r.correction_detaillee?.temps_ms);
    if (withTime.length === 0) return 0;
    return withTime.reduce((sum: number, r: any) => sum + (r.correction_detaillee.temps_ms || 0), 0) / withTime.length;
  }, [resultats]);

  // Map devoir_id -> latest result
  const resultatMap = useMemo(() => {
    const map: Record<string, any> = {};
    (resultats || []).forEach((r: any) => {
      if (r.devoir_id && (!map[r.devoir_id] || new Date(r.created_at) > new Date(map[r.devoir_id].created_at))) {
        map[r.devoir_id] = r;
      }
    });
    return map;
  }, [resultats]);

  // Filter devoirs
  const filteredDevoirs = useMemo(() => {
    let list = devoirs || [];

    if (statusFilter !== "all") {
      list = list.filter((d: any) => d.statut === statusFilter);
    }

    if (dateFilter !== "all") {
      const now = new Date();
      const cutoff = new Date();
      if (dateFilter === "7d") cutoff.setDate(now.getDate() - 7);
      else if (dateFilter === "30d") cutoff.setDate(now.getDate() - 30);
      else if (dateFilter === "90d") cutoff.setDate(now.getDate() - 90);
      list = list.filter((d: any) => new Date(d.created_at) >= cutoff);
    }

    // Sort: fait first, then en_attente, then expire
    const order: Record<string, number> = { fait: 0, en_attente: 1, expire: 2, arrete: 3 };
    return [...list].sort((a: any, b: any) => (order[a.statut] ?? 4) - (order[b.statut] ?? 4));
  }, [devoirs, statusFilter, dateFilter]);

  // Difficulty pre-selection logic
  const computePreselection = (devoir: any): DifficultyChoice => {
    const result = resultatMap[devoir.id];
    if (!result) return "same";
    const score = result.score ?? 0;
    const timeMs = result.correction_detaillee?.temps_ms ?? 0;
    const isFast = avgTimeMs > 0 && timeMs < avgTimeMs * 0.7;
    const isSlow = avgTimeMs > 0 && timeMs > avgTimeMs * 1.2;

    if (score >= 80 && isFast) return "much_harder";
    if (score >= 70 && !isSlow) return "harder";
    return "same";
  };

  const openResendModal = (devoir: any) => {
    const preselection = computePreselection(devoir);
    setDifficultyChoice(preselection);
    setResendDevoir(devoir);
  };

  const handleResend = async () => {
    if (!resendDevoir || !user) return;
    setResending(true);
    try {
      const ex = resendDevoir.exercice;
      const baseDifficulty = ex?.difficulte ?? 3;
      const newDifficulty = difficultyChoice === "much_harder"
        ? Math.min(5, baseDifficulty + 2)
        : difficultyChoice === "harder"
          ? Math.min(5, baseDifficulty + 1)
          : baseDifficulty;

      // Generate a new exercise via AI
      const { data: genData, error: genError } = await supabase.functions.invoke("generate-exercises", {
        body: {
          pointName: ex?.titre || "exercice",
          competence: ex?.competence,
          niveauVise: ex?.niveau_vise || "A1",
          count: 1,
          difficultyLevel: newDifficulty * 2,
          formatOverride: ex?.format,
        },
      });

      if (genError) throw genError;
      const generated = genData?.exercises?.[0] || genData?.exercise;
      if (!generated) throw new Error("Aucun exercice généré");

      // Insert new exercise
      const { data: newEx, error: exErr } = await supabase
        .from("exercices")
        .insert({
          titre: generated.titre || ex?.titre,
          consigne: generated.consigne || ex?.consigne,
          competence: ex?.competence,
          format: ex?.format || "qcm",
          niveau_vise: ex?.niveau_vise || "A1",
          difficulte: newDifficulty,
          contenu: generated.contenu || {},
          formateur_id: user.id,
          is_ai_generated: true,
          is_devoir: true,
          eleve_id: resendDevoir.eleve_id,
          point_a_maitriser_id: ex?.point_a_maitriser_id,
        } as any)
        .select()
        .single();

      if (exErr) throw exErr;

      // Create devoir
      const { error: devErr } = await supabase
        .from("devoirs")
        .insert({
          eleve_id: resendDevoir.eleve_id,
          exercice_id: newEx.id,
          formateur_id: user.id,
          raison: "consolidation" as any,
          statut: "en_attente" as any,
        });

      if (devErr) throw devErr;

      toast.success("Exercice renvoyé comme devoir !");
      setResendDevoir(null);
      qc.invalidateQueries({ queryKey: ["devoirs-formateur-all"] });
    } catch (e: any) {
      console.error(e);
      toast.error("Erreur lors du renvoi", { description: e.message });
    } finally {
      setResending(false);
    }
  };

  const getStatusDisplay = (statut: string) => {
    switch (statut) {
      case "fait":
        return { label: "Terminé", icon: CheckCircle2, className: "text-green-700 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-950/30 dark:border-green-800" };
      case "en_attente":
        return { label: "Non commencé", icon: Square, className: "text-muted-foreground bg-muted/50 border-border" };
      case "expire":
        return { label: "Expiré", icon: Clock, className: "text-orange-700 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-950/30 dark:border-orange-800" };
      case "arrete":
        return { label: "Arrêté", icon: CheckCircle2, className: "text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950/30 dark:border-blue-800" };
      default:
        return { label: statut, icon: Square, className: "text-muted-foreground bg-muted/50" };
    }
  };

  const getComprehensionColor = (score: number) => {
    if (score >= 70) return "text-green-600 dark:text-green-400";
    if (score >= 50) return "text-orange-600 dark:text-orange-400";
    return "text-destructive";
  };

  const formatTime = (ms: number) => {
    if (!ms) return "—";
    const totalSec = Math.round(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min} min ${sec.toString().padStart(2, "0")}`;
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const stats = {
    total: (devoirs || []).length,
    done: (devoirs || []).filter((d: any) => d.statut === "fait").length,
    pending: (devoirs || []).filter((d: any) => d.statut === "en_attente").length,
    expired: (devoirs || []).filter((d: any) => d.statut === "expire").length,
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" /> Devoirs
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Suivi de tous les devoirs envoyés aux élèves
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.done}</p>
            <p className="text-xs text-muted-foreground">Terminés ✅</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-muted-foreground">{stats.pending}</p>
            <p className="text-xs text-muted-foreground">Non commencés ⬜</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-orange-600">{stats.expired}</p>
            <p className="text-xs text-muted-foreground">Expirés 🟠</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="fait">Terminé ✅</SelectItem>
              <SelectItem value="en_attente">Non commencé ⬜</SelectItem>
              <SelectItem value="expire">Expiré 🟠</SelectItem>
              <SelectItem value="arrete">Arrêté</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="Période" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toute la période</SelectItem>
            <SelectItem value="7d">7 derniers jours</SelectItem>
            <SelectItem value="30d">30 derniers jours</SelectItem>
            <SelectItem value="90d">90 derniers jours</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filteredDevoirs.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground">Aucun devoir trouvé avec ces filtres.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Élève</TableHead>
                    <TableHead>Devoir</TableHead>
                    <TableHead className="text-center">Score</TableHead>
                    <TableHead className="text-center">Temps</TableHead>
                    <TableHead className="text-center">Statut</TableHead>
                    <TableHead className="text-center">Compréhension</TableHead>
                    <TableHead className="text-center">Envoyé le</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDevoirs.map((d: any) => {
                    const result = resultatMap[d.id];
                    const score = result?.score;
                    const timeMs = result?.correction_detaillee?.temps_ms;
                    const statusDisplay = getStatusDisplay(d.statut);
                    const StatusIcon = statusDisplay.icon;
                    const totalItems = (d.exercice?.contenu as any)?.items?.length || 10;
                    const scoreDisplay = score != null ? `${Math.round(score * totalItems / 100)}/${totalItems}` : "—";

                    return (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium">
                          {d.eleve?.prenom} {d.eleve?.nom}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{d.exercice?.titre || "—"}</span>
                            <Badge variant="secondary" className="text-[10px]">{d.exercice?.competence}</Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {score != null ? (
                            <span className={cn("font-semibold", getComprehensionColor(score))}>
                              {scoreDisplay}
                            </span>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground">
                          {formatTime(timeMs)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={cn("gap-1 text-[11px]", statusDisplay.className)}>
                            <StatusIcon className="h-3 w-3" />
                            {statusDisplay.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {score != null ? (
                            <span className={cn("font-semibold text-sm", getComprehensionColor(score))}>
                              {Math.round(score)}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground">
                          {format(new Date(d.created_at), "dd/MM/yyyy", { locale: fr })}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openResendModal(d)}>
                            <Send className="h-3.5 w-3.5" /> Renvoyer
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resend Dialog */}
      <Dialog open={!!resendDevoir} onOpenChange={(open) => { if (!open) setResendDevoir(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-4 w-4 text-primary" />
              Renvoyer un exercice
            </DialogTitle>
            <DialogDescription>
              L'IA va générer un nouvel exercice similaire avec la difficulté choisie et l'envoyer comme devoir.
            </DialogDescription>
          </DialogHeader>

          {resendDevoir && (
            <div className="space-y-4 pt-2">
              <div className="p-3 rounded-lg bg-muted/50 border space-y-1">
                <p className="text-sm font-medium">
                  Élève : {resendDevoir.eleve?.prenom} {resendDevoir.eleve?.nom}
                </p>
                <p className="text-xs text-muted-foreground">
                  Exercice précédent : {resendDevoir.exercice?.titre}
                </p>
                {resultatMap[resendDevoir.id] && (
                  <p className="text-xs text-muted-foreground">
                    Score obtenu : {Math.round(resultatMap[resendDevoir.id].score)}%
                    {resultatMap[resendDevoir.id].correction_detaillee?.temps_ms && (
                      <> · Temps : {formatTime(resultatMap[resendDevoir.id].correction_detaillee.temps_ms)}</>
                    )}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">Niveau de difficulté</Label>
                <RadioGroup value={difficultyChoice} onValueChange={(v) => setDifficultyChoice(v as DifficultyChoice)} className="space-y-2">
                  <div className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                    difficultyChoice === "same" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                  )}>
                    <RadioGroupItem value="same" id="same" />
                    <Label htmlFor="same" className="flex items-center gap-2 cursor-pointer flex-1">
                      <Minus className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Même difficulté</p>
                        <p className="text-xs text-muted-foreground">Niveau identique, contenu différent</p>
                      </div>
                    </Label>
                  </div>
                  <div className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                    difficultyChoice === "harder" ? "border-amber-500 bg-amber-50 dark:bg-amber-950/20" : "hover:bg-muted/50"
                  )}>
                    <RadioGroupItem value="harder" id="harder" />
                    <Label htmlFor="harder" className="flex items-center gap-2 cursor-pointer flex-1">
                      <TrendingUp className="h-4 w-4 text-amber-600" />
                      <div>
                        <p className="text-sm font-medium">🟡 Plus difficile</p>
                        <p className="text-xs text-muted-foreground">+1 cran de difficulté</p>
                      </div>
                    </Label>
                  </div>
                  <div className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                    difficultyChoice === "much_harder" ? "border-red-500 bg-red-50 dark:bg-red-950/20" : "hover:bg-muted/50"
                  )}>
                    <RadioGroupItem value="much_harder" id="much_harder" />
                    <Label htmlFor="much_harder" className="flex items-center gap-2 cursor-pointer flex-1">
                      <TrendingUp className="h-4 w-4 text-red-600" />
                      <div>
                        <p className="text-sm font-medium">🔴 Beaucoup plus difficile</p>
                        <p className="text-xs text-muted-foreground">+2 crans de difficulté</p>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setResendDevoir(null)}>Annuler</Button>
            <Button onClick={handleResend} disabled={resending} className="gap-2">
              {resending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Envoyer le devoir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DevoirsFormateur;
