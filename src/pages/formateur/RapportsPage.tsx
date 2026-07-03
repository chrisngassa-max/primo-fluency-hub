import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { FileText, Copy, Loader2, Check, User, Users, ShieldAlert, GraduationCap, ChevronRight } from "lucide-react";
import {
  collectQueryErrors,
  fetchGroupStudentsForReports,
  FORMATEUR_SHOW_REAL_NAMES,
  formatStudentRealName,
  PERIODE_DEPUIS_DEBUT,
  resolvePeriodBounds,
  resolveStudentExportLabel,
} from "@/lib/reportExportPrivacy";
import { Alert, AlertDescription } from "@/components/ui/alert";

const PERIODES = [
  { value: "7", label: "7 derniers jours" },
  { value: "14", label: "14 derniers jours" },
  { value: "30", label: "30 derniers jours" },
  { value: "90", label: "90 derniers jours" },
  { value: PERIODE_DEPUIS_DEBUT, label: "Depuis le début" },
];

type ReportMode = "individuel" | "groupe";

function applyDateFloor<T extends { gte: (col: string, val: string) => T }>(
  query: T,
  periode: string,
  dateDebutStr: string,
): T {
  if (periode === PERIODE_DEPUIS_DEBUT) return query;
  return query.gte("created_at", dateDebutStr);
}

export default function RapportsPage() {
  const { user } = useAuth();
  const [mode, setMode] = useState<ReportMode>("individuel");
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [selectedEleve, setSelectedEleve] = useState<string>("");
  const [periode, setPeriode] = useState("30");
  const [rapport, setRapport] = useState("");
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: groups, isLoading: loadingGroups } = useQuery({
    queryKey: ["rapports-groups", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("id, nom, niveau")
        .eq("formateur_id", user!.id)
        .eq("is_active", true)
        .order("nom");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const {
    data: eleves,
    isLoading: loadingEleves,
    isError: elevesError,
    error: elevesQueryError,
  } = useQuery({
    queryKey: ["rapports-eleves", selectedGroup],
    queryFn: () => fetchGroupStudentsForReports(supabase, selectedGroup),
    enabled: !!selectedGroup,
  });

  useEffect(() => {
    if (elevesError) {
      toast.error("Impossible de charger les élèves du groupe", {
        description: (elevesQueryError as Error)?.message ?? "Erreur inconnue",
      });
    }
  }, [elevesError, elevesQueryError]);

  const handleGroupChange = (v: string) => {
    setSelectedGroup(v);
    setSelectedEleve("");
    setRapport("");
  };

  const handleModeChange = (v: string) => {
    setMode(v as ReportMode);
    setRapport("");
  };

  const selectedGroupInfo = groups?.find((g) => g.id === selectedGroup);
  const groupHeaderLabel = selectedGroupInfo
    ? `${selectedGroupInfo.nom} (${selectedGroupInfo.niveau})`
    : selectedGroup;

  const resolveIndividualPeriodStart = async (): Promise<string | null> => {
    if (!selectedGroup || !selectedEleve) return null;
    const { data } = await supabase
      .from("group_members")
      .select("joined_at")
      .eq("group_id", selectedGroup)
      .eq("eleve_id", selectedEleve)
      .maybeSingle();
    return data?.joined_at ?? null;
  };

  const resolveGroupPeriodStart = async (): Promise<string | null> => {
    if (!selectedGroup) return null;
    const [membersRes, parcoursRes] = await Promise.all([
      supabase.from("group_members").select("joined_at").eq("group_id", selectedGroup),
      supabase
        .from("parcours")
        .select("created_at")
        .eq("group_id", selectedGroup)
        .order("created_at", { ascending: true })
        .limit(1),
    ]);
    const joinedDates = (membersRes.data ?? [])
      .map((m) => m.joined_at)
      .filter(Boolean) as string[];
    const parcoursStart = parcoursRes.data?.[0]?.created_at ?? null;
    const candidates = [...joinedDates, ...(parcoursStart ? [parcoursStart] : [])];
    if (!candidates.length) return null;
    return candidates.sort()[0];
  };

  const generateIndividualReport = async () => {
    if (!selectedEleve) {
      toast.error("Sélectionnez un élève pour générer le rapport individuel");
      return null;
    }
    if (!selectedGroup) {
      toast.error("Sélectionnez un groupe");
      return null;
    }

    const periodStart = periode === PERIODE_DEPUIS_DEBUT ? await resolveIndividualPeriodStart() : null;
    const { dateDebut, nbJours, label: periodeLabel } = resolvePeriodBounds(periode, periodStart);
    const dateDebutStr = dateDebut.toISOString();

    const resultatsQuery = applyDateFloor(
      supabase
        .from("resultats")
        .select("*, exercices(competence, titre, format)")
        .eq("eleve_id", selectedEleve)
        .order("created_at", { ascending: true }),
      periode,
      dateDebutStr,
    );
    const devoirsQuery = applyDateFloor(
      supabase
        .from("devoirs")
        .select("*, exercices(competence, titre)")
        .eq("eleve_id", selectedEleve),
      periode,
      dateDebutStr,
    );

    const [profilRes, resultatsRes, devoirsRes, testRes] = await Promise.all([
      supabase.from("profils_eleves").select("*").eq("eleve_id", selectedEleve).maybeSingle(),
      resultatsQuery,
      devoirsQuery,
      supabase
        .from("test_resultats_apprenants")
        .select("*")
        .eq("apprenant_id", selectedEleve)
        .order("date_test", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const queryErrors = collectQueryErrors(
      [profilRes, resultatsRes, devoirsRes, testRes],
      ["profil élève", "résultats", "devoirs", "test d'entrée"],
    );
    if (queryErrors.length > 0) {
      throw new Error(queryErrors.join(" ; "));
    }

    const profil = profilRes.data;
    const resultats = resultatsRes.data || [];
    const devoirs = devoirsRes.data || [];
    const testEntree = testRes.data;
    const exportLabel = resolveStudentExportLabel(selectedEleve, eleves);

    const joursActifs = new Set(resultats.map((r: { created_at?: string }) => r.created_at?.slice(0, 10))).size;
    const indexRegularite = `${joursActifs}/${nbJours}`;
    const itemsValides = resultats.filter((r: { score: number }) => r.score >= 80).length;
    const nbSemaines = Math.max(1, nbJours / 7);
    const vitesseAcquisition = (itemsValides / nbSemaines).toFixed(1);
    const tentativesMoyenne =
      resultats.length > 0
        ? (
            resultats.reduce((s: number, r: { tentative?: number }) => s + (r.tentative || 1), 0) /
            resultats.length
          ).toFixed(1)
        : "N/A";

    const scoreCO = profil?.taux_reussite_co ?? "N/A";
    const scoreCE = profil?.taux_reussite_ce ?? "N/A";
    const scoreEE = profil?.taux_reussite_ee ?? "N/A";
    const scoreEO = profil?.taux_reussite_eo ?? "N/A";
    const moyenneGlobale = profil?.taux_reussite_global ?? "N/A";

    let signalStagnation = "N/A";
    if (resultats.length >= 4) {
      const mid = Math.floor(resultats.length / 2);
      const avgFirst =
        resultats.slice(0, mid).reduce((s: number, r: { score: number }) => s + r.score, 0) / mid;
      const avgSecond =
        resultats.slice(mid).reduce((s: number, r: { score: number }) => s + r.score, 0) /
        (resultats.length - mid);
      signalStagnation = Math.abs(avgSecond - avgFirst) < 5 ? "True" : "False";
    }

    const compScores: Record<string, number> = {
      CO: Number(scoreCO) || 0,
      CE: Number(scoreCE) || 0,
      EE: Number(scoreEE) || 0,
      EO: Number(scoreEO) || 0,
    };
    const lowest = Object.entries(compScores).sort((a, b) => a[1] - b[1])[0];
    const signalBlocage = lowest && lowest[1] < 50 ? lowest[0] : "Aucun";

    const niveauCible = selectedGroupInfo?.niveau || "A1";

    return `=== RAPPORT D'ANALYSE PEDAGOGIQUE (Niveau cible: ${niveauCible} TCF IRN) ===

[CONTEXTE APPRENANT]
Nom_Groupe: ${groupHeaderLabel}
Identifiant_export: ${exportLabel}
L1: À remplir
Période: ${periodeLabel}

[ENGAGEMENT ET DYNAMIQUE]
Index_Regularite: ${indexRegularite}
Vitesse_Acquisition: ${vitesseAcquisition} items validés/semaine
Ratio_Persistance: ${tentativesMoyenne} tentatives/exercice

[PERFORMANCE TCF IRN (${niveauCible})]
Score_CO: ${scoreCO}/100
Score_CE: ${scoreCE}/100
Score_EE: ${scoreEE}/100
Score_EO: ${scoreEO}/100
Mots_EE_T1: À remplir (Seuil critique: 30)
Validation_Globale_${niveauCible}: ${moyenneGlobale}%

[DIAGNOSTIC CLINIQUE]
Signal_Stagnation: ${signalStagnation}
Signal_Blocage: ${signalBlocage}
Nb_Resultats_Periode: ${resultats.length}
Nb_Devoirs_Actifs: ${devoirs.filter((d: { statut: string }) => d.statut === "en_attente").length}
Nb_Devoirs_Expires: ${devoirs.filter((d: { statut: string }) => d.statut === "expire").length}
Score_Risque: ${profil?.score_risque ?? "N/A"}/100
Niveau_Actuel_Estime: ${profil?.niveau_actuel || testEntree?.profil || "N/A"}

================================================================`;
  };

  const generateGroupReport = async () => {
    if (!selectedGroup) {
      toast.error("Sélectionnez un groupe");
      return null;
    }

    const periodStart = periode === PERIODE_DEPUIS_DEBUT ? await resolveGroupPeriodStart() : null;
    const { dateDebut, nbJours, label: periodeLabel } = resolvePeriodBounds(periode, periodStart);
    const dateDebutStr = dateDebut.toISOString();

    const niveauCible = selectedGroupInfo?.niveau || "A1";

    const { data: membersData, error: membersErr } = await supabase
      .from("group_members")
      .select("eleve_id")
      .eq("group_id", selectedGroup);
    if (membersErr) throw new Error(`membres du groupe: ${membersErr.message}`);
    const eleveIds = (membersData ?? []).map((m) => m.eleve_id);
    const effectif = eleveIds.length;

    if (effectif === 0) {
      return `=== RAPPORT D'ANALYSE DE GROUPE (Niveau cible: ${niveauCible} TCF IRN) ===

[CONTEXTE GROUPE]
Nom_Groupe: ${groupHeaderLabel}
Effectif: 0 apprenants
Période: ${periodeLabel}
Note: Aucun élève dans ce groupe.

================================================================`;
    }

    const resultatsQuery = applyDateFloor(
      supabase
        .from("resultats")
        .select("*, exercices(competence, titre, format)")
        .in("eleve_id", eleveIds)
        .order("created_at", { ascending: true }),
      periode,
      dateDebutStr,
    );
    const devoirsQuery = applyDateFloor(
      supabase.from("devoirs").select("*").in("eleve_id", eleveIds),
      periode,
      dateDebutStr,
    );

    const [sessionsRes, profilsRes, resultatsRes, devoirsRes, parcoursRes] = await Promise.all([
      supabase.from("sessions").select("id, statut").eq("group_id", selectedGroup),
      supabase.from("profils_eleves").select("*").in("eleve_id", eleveIds),
      resultatsQuery,
      devoirsQuery,
      supabase.from("parcours").select("nb_seances_prevues").eq("group_id", selectedGroup),
    ]);

    const queryErrors = collectQueryErrors(
      [sessionsRes, profilsRes, resultatsRes, devoirsRes, parcoursRes],
      ["sessions", "profils", "résultats", "devoirs", "parcours"],
    );
    if (queryErrors.length > 0) {
      throw new Error(queryErrors.join(" ; "));
    }

    const sessions = sessionsRes.data || [];
    const profils = profilsRes.data || [];
    const resultats = resultatsRes.data || [];
    const devoirs = devoirsRes.data || [];

    const seancesTerminees = sessions.filter((s) => s.statut === "terminee").length;
    const seancesTotal =
      (parcoursRes.data ?? []).reduce((max, p) => Math.max(max, p.nb_seances_prevues || 0), 0) ||
      sessions.length ||
      0;

    const joursActifsParEleve: Record<string, Set<string>> = {};
    resultats.forEach((r: { eleve_id: string; created_at?: string }) => {
      if (!joursActifsParEleve[r.eleve_id]) joursActifsParEleve[r.eleve_id] = new Set();
      joursActifsParEleve[r.eleve_id].add(r.created_at?.slice(0, 10) ?? "");
    });
    const assiduites = eleveIds.map((id) => {
      const jours = joursActifsParEleve[id]?.size || 0;
      return nbJours > 0 ? (jours / nbJours) * 100 : 0;
    });
    const assiduiteMoyenne =
      assiduites.length > 0 ? Math.round(assiduites.reduce((a, b) => a + b, 0) / assiduites.length) : 0;

    const totalDevoirs = devoirs.length;
    const devoirsFaits = devoirs.filter(
      (d: { statut: string }) => d.statut === "fait" || d.statut === "arrete",
    ).length;
    const tauxDevoirs = totalDevoirs > 0 ? Math.round((devoirsFaits / totalDevoirs) * 100) : 0;

    const itemsValidesTotal = resultats.filter((r: { score: number }) => r.score >= 80).length;
    const nbSemaines = Math.max(1, nbJours / 7);
    const vitesseMoyenne = (itemsValidesTotal / effectif / nbSemaines).toFixed(1);

    const avg = (key: string) => {
      const vals = profils.map((p: Record<string, unknown>) => Number(p[key]) || 0);
      return vals.length > 0 ? Math.round(vals.reduce((a: number, b: number) => a + b, 0) / vals.length) : 0;
    };
    const moyenneCO = avg("taux_reussite_co");
    const moyenneCE = avg("taux_reussite_ce");
    const moyenneEE = avg("taux_reussite_ee");
    const moyenneEO = avg("taux_reussite_eo");
    const moyenneStructures = avg("taux_reussite_structures");
    const moyenneGlobale = avg("taux_reussite_global");

    const globaux = profils.map((p: { taux_reussite_global?: unknown }) => Number(p.taux_reussite_global) || 0);
    const minScore = globaux.length > 0 ? Math.min(...globaux) : 0;
    const maxScore = globaux.length > 0 ? Math.max(...globaux) : 0;
    const elevesDecrochage = globaux.filter((s) => s < 40).length;

    const compMoyennes: Record<string, number> = {
      CO: moyenneCO,
      CE: moyenneCE,
      EE: moyenneEE,
      EO: moyenneEO,
      Structures: moyenneStructures,
    };
    const competenceFaible = Object.entries(compMoyennes).sort((a, b) => a[1] - b[1])[0];

    const exerciceEchecs: Record<string, { titre: string; competence: string; echoues: number }> = {};
    resultats.forEach((r: { exercice_id: string; score: number; exercices?: { titre?: string; competence?: string } }) => {
      const exId = r.exercice_id;
      if (!exerciceEchecs[exId]) {
        exerciceEchecs[exId] = {
          titre: r.exercices?.titre || "Exercice",
          competence: r.exercices?.competence || "?",
          echoues: 0,
        };
      }
      if (r.score < 50) exerciceEchecs[exId].echoues++;
    });
    const seuilMajorite = Math.ceil(effectif * 0.5);
    const sujetsEchoues = Object.values(exerciceEchecs)
      .filter((e) => e.echoues >= seuilMajorite)
      .map((e) => `${e.titre} (${e.competence})`)
      .slice(0, 5);

    return `=== RAPPORT D'ANALYSE DE GROUPE (Niveau cible: ${niveauCible} TCF IRN) ===

[CONTEXTE GROUPE]
Nom_Groupe: ${groupHeaderLabel}
Effectif: ${effectif} apprenants
Avancement_Programme: ${seancesTerminees}/${seancesTotal} séances
Période: ${periodeLabel}

[DYNAMIQUE ET ENGAGEMENT GLOBAL]
Assiduite_Moyenne: ${assiduiteMoyenne}%
Taux_Realisation_Devoirs: ${tauxDevoirs}%
Vitesse_Acquisition_Moyenne: ${vitesseMoyenne} items validés/semaine/apprenant

[PERFORMANCE TCF IRN - MOYENNES DU GROUPE]
Moyenne_CO: ${moyenneCO}/100
Moyenne_CE: ${moyenneCE}/100
Moyenne_EE: ${moyenneEE}/100
Moyenne_EO: ${moyenneEO}/100
Moyenne_Structures: ${moyenneStructures}/100
Validation_Globale_${niveauCible}_Groupe: ${moyenneGlobale}%

[HÉTÉROGÉNÉITÉ ET BLOCAGES]
Ecart_de_Niveau_Global: [Min: ${minScore}% - Max: ${maxScore}%]
Eleves_En_Decrochage: ${elevesDecrochage} apprenants (sous 40%)
Competence_La_Plus_Faible: ${competenceFaible ? `${competenceFaible[0]} (${competenceFaible[1]}%)` : "N/A"}
Sujets_Echoues_Majoritairement: ${sujetsEchoues.length > 0 ? sujetsEchoues.join(" | ") : "Aucun exercice échoué par la majorité"}

================================================================`;
  };

  const handleGenerate = async () => {
    if (mode === "individuel" && !selectedEleve) {
      toast.error("Sélectionnez un élève pour générer le rapport individuel");
      return;
    }
    if (!selectedGroup) {
      toast.error("Sélectionnez un groupe");
      return;
    }

    setGenerating(true);
    try {
      const text =
        mode === "individuel" ? await generateIndividualReport() : await generateGroupReport();
      if (text) {
        setRapport(text);
        toast.success("Rapport généré avec succès");
      }
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Erreur lors de la génération du rapport";
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rapport);
      setCopied(true);
      toast.success("Copié !");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Impossible de copier");
    }
  };

  const canGenerate = mode === "individuel" ? !!selectedEleve && !!selectedGroup : !!selectedGroup;
  const studentLabel = (e: { id: string; prenom?: string | null; nom?: string | null }) =>
    FORMATEUR_SHOW_REAL_NAMES ? formatStudentRealName(e) : resolveStudentExportLabel(e.id, eleves);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Rapports IA</h1>
        <p className="text-sm text-muted-foreground">
          Génère un rapport pédagogique détaillé que vous pouvez soumettre à votre assistant IA (ChatGPT,
          NotebookLM…) pour obtenir des recommandations approfondies.
        </p>
        {!FORMATEUR_SHOW_REAL_NAMES && (
          <Alert className="mt-3 border-amber-500/40 bg-amber-500/5">
            <ShieldAlert className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-sm text-muted-foreground">
              Les rapports exportés utilisent des identifiants opaques (ex. Apprenant_A) — jamais de prénom,
              nom ni UUID. Vérifiez avant copie qu&apos;aucune donnée personnelle n&apos;a été ajoutée
              manuellement.
            </AlertDescription>
          </Alert>
        )}
      </div>

      <Alert className="border-primary/30 bg-primary/5">
        <GraduationCap className="h-4 w-4 text-primary" />
        <AlertDescription className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span>
            Pour les graphiques de progression IPE (Indicateur de Préparation à l&apos;Examen), consultez la
            fiche dédiée.
          </span>
          <Button variant="outline" size="sm" className="gap-1 shrink-0" asChild>
            <Link to="/formateur/preparation-examen">
              Préparation examen (IPE)
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Paramètres du rapport</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={mode} onValueChange={handleModeChange}>
            <TabsList className="grid w-full grid-cols-2 max-w-md">
              <TabsTrigger value="individuel" className="gap-1.5">
                <User className="h-4 w-4" />
                Rapport Individuel
              </TabsTrigger>
              <TabsTrigger value="groupe" className="gap-1.5">
                <Users className="h-4 w-4" />
                Rapport de Groupe
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Groupe</label>
              {loadingGroups ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select value={selectedGroup} onValueChange={handleGroupChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un groupe" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups?.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.nom} ({g.niveau})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {mode === "individuel" && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Élève</label>
                {loadingEleves && selectedGroup ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <>
                    <Select
                      value={selectedEleve}
                      onValueChange={setSelectedEleve}
                      disabled={!selectedGroup || elevesError}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            !selectedGroup
                              ? "Sélectionnez d'abord un groupe"
                              : eleves?.length
                                ? "Choisir un élève"
                                : "Aucun élève dans ce groupe"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {eleves?.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {studentLabel(e)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedGroup && !loadingEleves && eleves?.length === 0 && !elevesError && (
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        Aucun élève dans ce groupe — inscrivez des élèves dans Gestion → Groupes.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Période</label>
              <Select value={periode} onValueChange={setPeriode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIODES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button className="mt-2 w-full md:w-auto" onClick={handleGenerate} disabled={!canGenerate || generating}>
            {generating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileText className="mr-2 h-4 w-4" />
            )}
            Générer le rapport IA
          </Button>
        </CardContent>
      </Card>

      {rapport && (
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base">Rapport généré</CardTitle>
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              {copied ? "Copié !" : "Copier le rapport"}
            </Button>
          </CardHeader>
          <CardContent>
            <Textarea
              value={rapport}
              onChange={(e) => setRapport(e.target.value)}
              className="min-h-[400px] font-mono text-xs leading-relaxed bg-muted/50"
              spellCheck={false}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
