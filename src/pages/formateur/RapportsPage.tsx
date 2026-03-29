import { useState } from "react";
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
import { FileText, Copy, Loader2, Check, User, Users } from "lucide-react";

const PERIODES = [
  { value: "7", label: "7 derniers jours" },
  { value: "14", label: "14 derniers jours" },
  { value: "30", label: "30 derniers jours" },
  { value: "90", label: "90 derniers jours" },
];

type ReportMode = "individuel" | "groupe";

export default function RapportsPage() {
  const { user } = useAuth();
  const [mode, setMode] = useState<ReportMode>("individuel");
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [selectedEleve, setSelectedEleve] = useState<string>("");
  const [periode, setPeriode] = useState("30");
  const [rapport, setRapport] = useState("");
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch groups
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

  // Fetch students for selected group
  const { data: eleves, isLoading: loadingEleves } = useQuery({
    queryKey: ["rapports-eleves", selectedGroup],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_members")
        .select("eleve_id, profiles!group_members_eleve_id_fkey(id, prenom, nom, email)")
        .eq("group_id", selectedGroup);
      if (error) throw error;
      return data?.map((m: any) => m.profiles).filter(Boolean) || [];
    },
    enabled: !!selectedGroup,
  });

  const handleGroupChange = (v: string) => {
    setSelectedGroup(v);
    setSelectedEleve("");
  };

  const handleModeChange = (v: string) => {
    setMode(v as ReportMode);
    setRapport("");
  };

  // ─── Individual report generation ───
  const generateIndividualReport = async () => {
    if (!selectedEleve) {
      toast.error("Sélectionnez un élève");
      return;
    }

    const dateDebut = new Date();
    dateDebut.setDate(dateDebut.getDate() - parseInt(periode));
    const dateDebutStr = dateDebut.toISOString();

    const [profilRes, resultatsRes, devoirsRes, testRes, profileRes] = await Promise.all([
      supabase.from("profils_eleves").select("*").eq("eleve_id", selectedEleve).maybeSingle(),
      supabase.from("resultats").select("*, exercices(competence, titre, format)").eq("eleve_id", selectedEleve).gte("created_at", dateDebutStr).order("created_at", { ascending: true }),
      supabase.from("devoirs").select("*, exercices(competence, titre)").eq("eleve_id", selectedEleve).gte("created_at", dateDebutStr),
      supabase.from("tests_entree").select("*").eq("eleve_id", selectedEleve).maybeSingle(),
      supabase.from("profiles").select("prenom, nom").eq("id", selectedEleve).single(),
    ]);

    const profil = profilRes.data;
    const resultats = resultatsRes.data || [];
    const devoirs = devoirsRes.data || [];
    const testEntree = testRes.data;
    const studentProfile = profileRes.data;

    const nbJoursPeriode = parseInt(periode);
    const joursActifs = new Set(resultats.map((r: any) => r.created_at?.slice(0, 10))).size;
    const indexRegularite = nbJoursPeriode > 0 ? `${joursActifs}/${nbJoursPeriode}` : "N/A";
    const itemsValides = resultats.filter((r: any) => r.score >= 80).length;
    const nbSemaines = Math.max(1, nbJoursPeriode / 7);
    const vitesseAcquisition = (itemsValides / nbSemaines).toFixed(1);
    const tentativesMoyenne = resultats.length > 0
      ? (resultats.reduce((s: number, r: any) => s + (r.tentative || 1), 0) / resultats.length).toFixed(1)
      : "N/A";

    const scoreCO = profil?.taux_reussite_co ?? "N/A";
    const scoreCE = profil?.taux_reussite_ce ?? "N/A";
    const scoreEE = profil?.taux_reussite_ee ?? "N/A";
    const scoreEO = profil?.taux_reussite_eo ?? "N/A";
    const moyenneGlobale = profil?.taux_reussite_global ?? "N/A";

    let signalStagnation = "N/A";
    if (resultats.length >= 4) {
      const mid = Math.floor(resultats.length / 2);
      const avgFirst = resultats.slice(0, mid).reduce((s: number, r: any) => s + r.score, 0) / mid;
      const avgSecond = resultats.slice(mid).reduce((s: number, r: any) => s + r.score, 0) / (resultats.length - mid);
      signalStagnation = Math.abs(avgSecond - avgFirst) < 5 ? "True" : "False";
    }

    const compScores: Record<string, number> = { CO: Number(scoreCO) || 0, CE: Number(scoreCE) || 0, EE: Number(scoreEE) || 0, EO: Number(scoreEO) || 0 };
    const lowest = Object.entries(compScores).sort((a, b) => a[1] - b[1])[0];
    const signalBlocage = lowest && lowest[1] < 50 ? lowest[0] : "Aucun";

    const group = groups?.find((g: any) => g.id === selectedGroup);
    const niveauCible = group?.niveau || "A1";
    const dateDebutFmt = dateDebut.toLocaleDateString("fr-FR");
    const dateFinFmt = new Date().toLocaleDateString("fr-FR");

    return `=== RAPPORT D'ANALYSE PEDAGOGIQUE (Niveau cible: ${niveauCible} TCF IRN) ===

[CONTEXTE APPRENANT]
ID: ${studentProfile?.prenom || ""} ${studentProfile?.nom || ""} (${selectedEleve.slice(0, 8)})
L1: À remplir
Période: ${dateDebutFmt} à ${dateFinFmt}

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
Nb_Devoirs_Actifs: ${devoirs.filter((d: any) => d.statut === "en_attente").length}
Nb_Devoirs_Expires: ${devoirs.filter((d: any) => d.statut === "expire").length}
Score_Risque: ${profil?.score_risque ?? "N/A"}/100
Niveau_Actuel_Estime: ${profil?.niveau_actuel || testEntree?.niveau_estime || "N/A"}

================================================================`;
  };

  // ─── Group report generation ───
  const generateGroupReport = async () => {
    if (!selectedGroup) {
      toast.error("Sélectionnez un groupe");
      return;
    }

    const dateDebut = new Date();
    dateDebut.setDate(dateDebut.getDate() - parseInt(periode));
    const dateDebutStr = dateDebut.toISOString();

    const group = groups?.find((g: any) => g.id === selectedGroup);
    const niveauCible = group?.niveau || "A1";
    const dateDebutFmt = dateDebut.toLocaleDateString("fr-FR");
    const dateFinFmt = new Date().toLocaleDateString("fr-FR");

    // 1. Get group members
    const { data: membersData } = await supabase
      .from("group_members")
      .select("eleve_id")
      .eq("group_id", selectedGroup);
    const eleveIds = (membersData ?? []).map((m) => m.eleve_id);
    const effectif = eleveIds.length;

    if (effectif === 0) {
      return `=== RAPPORT D'ANALYSE DE GROUPE (Niveau cible: ${niveauCible} TCF IRN) ===

[CONTEXTE GROUPE]
ID_Groupe: ${group?.nom || selectedGroup}
Effectif: 0 apprenants
Note: Aucun élève dans ce groupe.

================================================================`;
    }

    // 2. Fetch data in parallel
    const [sessionsRes, profilsRes, resultatsRes, devoirsRes, parcoursRes] = await Promise.all([
      supabase.from("sessions").select("id, statut").eq("group_id", selectedGroup),
      supabase.from("profils_eleves").select("*").in("eleve_id", eleveIds),
      supabase.from("resultats").select("*, exercices(competence, titre, format)").in("eleve_id", eleveIds).gte("created_at", dateDebutStr).order("created_at", { ascending: true }),
      supabase.from("devoirs").select("*").in("eleve_id", eleveIds).gte("created_at", dateDebutStr),
      supabase.from("parcours").select("nb_seances_prevues").eq("group_id", selectedGroup),
    ]);

    const sessions = sessionsRes.data || [];
    const profils = profilsRes.data || [];
    const resultats = resultatsRes.data || [];
    const devoirs = devoirsRes.data || [];

    // Sessions
    const seancesTerminees = sessions.filter((s) => s.statut === "terminee").length;
    const seancesTotal = (parcoursRes.data ?? []).reduce((max, p) => Math.max(max, p.nb_seances_prevues || 0), 0) || sessions.length || 0;

    // Attendance proxy: unique active days per student / period days
    const nbJoursPeriode = parseInt(periode);
    const joursActifsParEleve: Record<string, Set<string>> = {};
    resultats.forEach((r: any) => {
      if (!joursActifsParEleve[r.eleve_id]) joursActifsParEleve[r.eleve_id] = new Set();
      joursActifsParEleve[r.eleve_id].add(r.created_at?.slice(0, 10));
    });
    const assiduites = eleveIds.map((id) => {
      const jours = joursActifsParEleve[id]?.size || 0;
      return nbJoursPeriode > 0 ? (jours / nbJoursPeriode) * 100 : 0;
    });
    const assiduiteMoyenne = assiduites.length > 0
      ? Math.round(assiduites.reduce((a, b) => a + b, 0) / assiduites.length)
      : 0;

    // Homework completion rate
    const totalDevoirs = devoirs.length;
    const devoirsFaits = devoirs.filter((d: any) => d.statut === "fait" || d.statut === "arrete").length;
    const tauxDevoirs = totalDevoirs > 0 ? Math.round((devoirsFaits / totalDevoirs) * 100) : 0;

    // Average acquisition speed
    const itemsValidesTotal = resultats.filter((r: any) => r.score >= 80).length;
    const nbSemaines = Math.max(1, nbJoursPeriode / 7);
    const vitesseMoyenne = (itemsValidesTotal / effectif / nbSemaines).toFixed(1);

    // Competence averages from profils
    const avg = (key: string) => {
      const vals = profils.map((p: any) => Number(p[key]) || 0);
      return vals.length > 0 ? Math.round(vals.reduce((a: number, b: number) => a + b, 0) / vals.length) : 0;
    };
    const moyenneCO = avg("taux_reussite_co");
    const moyenneCE = avg("taux_reussite_ce");
    const moyenneEE = avg("taux_reussite_ee");
    const moyenneEO = avg("taux_reussite_eo");
    const moyenneStructures = avg("taux_reussite_structures");
    const moyenneGlobale = avg("taux_reussite_global");

    // Heterogeneity
    const globaux = profils.map((p: any) => Number(p.taux_reussite_global) || 0);
    const minScore = globaux.length > 0 ? Math.min(...globaux) : 0;
    const maxScore = globaux.length > 0 ? Math.max(...globaux) : 0;

    // Students at risk (below 40%)
    const elevesDecrochage = globaux.filter((s) => s < 40).length;

    // Weakest competence
    const compMoyennes: Record<string, number> = {
      CO: moyenneCO, CE: moyenneCE, EE: moyenneEE, EO: moyenneEO, Structures: moyenneStructures,
    };
    const competenceFaible = Object.entries(compMoyennes).sort((a, b) => a[1] - b[1])[0];

    // Exercises failed by >50% of group
    const exerciceEchecs: Record<string, { titre: string; competence: string; echoues: number }> = {};
    resultats.forEach((r: any) => {
      const exId = r.exercice_id;
      if (!exerciceEchecs[exId]) {
        exerciceEchecs[exId] = {
          titre: r.exercices?.titre || exId.slice(0, 8),
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
ID_Groupe: ${group?.nom || selectedGroup}
Effectif: ${effectif} apprenants
Avancement_Programme: ${seancesTerminees}/${seancesTotal} séances
Période: ${dateDebutFmt} à ${dateFinFmt}

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
    setGenerating(true);
    try {
      const text = mode === "individuel"
        ? await generateIndividualReport()
        : await generateGroupReport();
      if (text) {
        setRapport(text);
        toast.success("Rapport généré avec succès");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Erreur lors de la génération du rapport");
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

  const canGenerate = mode === "individuel" ? !!selectedEleve : !!selectedGroup;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Rapports IA</h1>
        <p className="text-sm text-muted-foreground">Génère un rapport pédagogique détaillé que vous pouvez soumettre à votre assistant IA (ChatGPT, NotebookLM…) pour obtenir des recommandations approfondies.</p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Paramètres du rapport</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mode toggle */}
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
            {/* Group */}
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
                    {groups?.map((g: any) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.nom} ({g.niveau})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Student (only in individual mode) */}
            {mode === "individuel" && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Élève</label>
                {loadingEleves && selectedGroup ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <Select value={selectedEleve} onValueChange={setSelectedEleve} disabled={!selectedGroup}>
                    <SelectTrigger>
                      <SelectValue placeholder={selectedGroup ? "Choisir un élève" : "Sélectionnez d'abord un groupe"} />
                    </SelectTrigger>
                    <SelectContent>
                      {eleves?.map((e: any) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.prenom} {e.nom}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {/* Period */}
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

          <Button
            className="mt-2 w-full md:w-auto"
            onClick={handleGenerate}
            disabled={!canGenerate || generating}
          >
            {generating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileText className="mr-2 h-4 w-4" />
            )}
            Générer le rapport IA
          </Button>
        </CardContent>
      </Card>

      {/* Report output */}
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
