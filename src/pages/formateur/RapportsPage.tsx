import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { FileText, Copy, Loader2, Check } from "lucide-react";

const PERIODES = [
  { value: "7", label: "7 derniers jours" },
  { value: "14", label: "14 derniers jours" },
  { value: "30", label: "30 derniers jours" },
  { value: "90", label: "90 derniers jours" },
];

export default function RapportsPage() {
  const { user } = useAuth();
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

  // Reset student when group changes
  const handleGroupChange = (v: string) => {
    setSelectedGroup(v);
    setSelectedEleve("");
  };

  const handleGenerate = async () => {
    if (!selectedEleve) {
      toast.error("Sélectionnez un élève");
      return;
    }

    setGenerating(true);
    try {
      const dateDebut = new Date();
      dateDebut.setDate(dateDebut.getDate() - parseInt(periode));
      const dateDebutStr = dateDebut.toISOString();
      const dateFinStr = new Date().toISOString();

      // Fetch all data in parallel
      const [profilRes, resultatsRes, devoirsRes, testRes, statusRes, profileRes] = await Promise.all([
        supabase.from("profils_eleves").select("*").eq("eleve_id", selectedEleve).maybeSingle(),
        supabase.from("resultats").select("*, exercices(competence, titre, format)").eq("eleve_id", selectedEleve).gte("created_at", dateDebutStr).order("created_at", { ascending: true }),
        supabase.from("devoirs").select("*, exercices(competence, titre)").eq("eleve_id", selectedEleve).gte("created_at", dateDebutStr),
        supabase.from("tests_entree").select("*").eq("eleve_id", selectedEleve).maybeSingle(),
        supabase.from("student_competency_status").select("*").eq("eleve_id", selectedEleve),
        supabase.from("profiles").select("prenom, nom").eq("id", selectedEleve).single(),
      ]);

      const profil = profilRes.data;
      const resultats = resultatsRes.data || [];
      const devoirs = devoirsRes.data || [];
      const testEntree = testRes.data;
      const statuses = statusRes.data || [];
      const studentProfile = profileRes.data;

      // Compute KPIs
      const nbJoursPeriode = parseInt(periode);
      const joursActifs = new Set(resultats.map((r: any) => r.created_at?.slice(0, 10))).size;
      const indexRegularite = nbJoursPeriode > 0 ? `${joursActifs}/${nbJoursPeriode}` : "N/A";

      // Items validated per week (score >= 80)
      const itemsValides = resultats.filter((r: any) => r.score >= 80).length;
      const nbSemaines = Math.max(1, nbJoursPeriode / 7);
      const vitesseAcquisition = (itemsValides / nbSemaines).toFixed(1);

      // Average attempts per exercise
      const tentativesMoyenne = resultats.length > 0
        ? (resultats.reduce((s: number, r: any) => s + (r.tentative || 1), 0) / resultats.length).toFixed(1)
        : "N/A";

      // Competence scores from profil
      const scoreCO = profil?.taux_reussite_co ?? "N/A";
      const scoreCE = profil?.taux_reussite_ce ?? "N/A";
      const scoreEE = profil?.taux_reussite_ee ?? "N/A";
      const scoreEO = profil?.taux_reussite_eo ?? "N/A";
      const moyenneGlobale = profil?.taux_reussite_global ?? "N/A";

      // Stagnation: compare first half vs second half of results
      let signalStagnation = "N/A";
      if (resultats.length >= 4) {
        const mid = Math.floor(resultats.length / 2);
        const avgFirst = resultats.slice(0, mid).reduce((s: number, r: any) => s + r.score, 0) / mid;
        const avgSecond = resultats.slice(mid).reduce((s: number, r: any) => s + r.score, 0) / (resultats.length - mid);
        signalStagnation = Math.abs(avgSecond - avgFirst) < 5 ? "True" : "False";
      }

      // Blocking competence (lowest score < 50)
      const compScores: Record<string, number> = {
        CO: Number(scoreCO) || 0,
        CE: Number(scoreCE) || 0,
        EE: Number(scoreEE) || 0,
        EO: Number(scoreEO) || 0,
      };
      const lowest = Object.entries(compScores).sort((a, b) => a[1] - b[1])[0];
      const signalBlocage = lowest && lowest[1] < 50 ? lowest[0] : "Aucun";

      const group = groups?.find((g: any) => g.id === selectedGroup);
      const niveauCible = group?.niveau || "A1";

      const dateDebutFmt = dateDebut.toLocaleDateString("fr-FR");
      const dateFinFmt = new Date().toLocaleDateString("fr-FR");

      const text = `=== RAPPORT D'ANALYSE PEDAGOGIQUE (Niveau cible: ${niveauCible} TCF IRN) ===

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

      setRapport(text);
      toast.success("Rapport généré avec succès");
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Rapports IA</h1>
        <p className="text-sm text-muted-foreground">Génère un rapport texte brut optimisé pour NotebookLM</p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtres</CardTitle>
        </CardHeader>
        <CardContent>
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

            {/* Student */}
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
            className="mt-4 w-full md:w-auto"
            onClick={handleGenerate}
            disabled={!selectedEleve || generating}
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
