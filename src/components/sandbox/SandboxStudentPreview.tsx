import { useEffect, useState } from "react";
import { BookOpen, Gauge, GraduationCap, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import type { SandboxLevel } from "@/contexts/SandboxContext";
import SandboxExerciseRunner from "@/components/sandbox/SandboxExerciseRunner";
import { getEdgeFunctionErrorMessage } from "@/lib/edgeFunctionError";

export default function SandboxStudentPreview({ niveau }: { niveau: SandboxLevel }) {
  const [tab, setTab] = useState<"dashboard" | "devoirs">("dashboard");
  const [dashboard, setDashboard] = useState<any>(null);
  const [devoirs, setDevoirs] = useState<any[]>([]);
  const [activeDevoir, setActiveDevoir] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async (resource: "dashboard" | "devoirs") => {
    setLoading(true);
    setError("");
    const { data, error: invokeError } = await supabase.functions.invoke("sandbox-preview-data", {
      body: { niveau, resource },
    });
    setLoading(false);
    if (invokeError) {
      setError(await getEdgeFunctionErrorMessage(invokeError, "Vue eleve indisponible"));
      return;
    }
    if (resource === "dashboard") setDashboard(data);
    else setDevoirs(data?.devoirs ?? []);
  };

  useEffect(() => {
    setActiveDevoir(null);
    void load(tab);
  }, [niveau, tab]);

  const openDevoir = async (devoirId: string) => {
    setLoading(true);
    const { data, error: invokeError } = await supabase.functions.invoke("sandbox-preview-data", {
      body: { niveau, resource: "exercice", payload: { devoir_id: devoirId } },
    });
    setLoading(false);
    if (invokeError) setError(await getEdgeFunctionErrorMessage(invokeError, "Exercice indisponible"));
    else setActiveDevoir(data.devoir);
  };

  if (activeDevoir) {
    return (
      <SandboxExerciseRunner
        niveau={niveau}
        devoir={activeDevoir}
        onBack={() => setActiveDevoir(null)}
        onCompleted={() => void load("devoirs")}
      />
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Badge className="bg-amber-700">Apercu Eleve {niveau}</Badge>
          <span className="text-sm text-amber-950">La session formateur reste active.</span>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant={tab === "dashboard" ? "default" : "outline"} onClick={() => setTab("dashboard")}>Tableau de bord</Button>
            <Button size="sm" variant={tab === "devoirs" ? "default" : "outline"} onClick={() => setTab("devoirs")}>Devoirs</Button>
          </div>
        </div>
      </div>

      {loading && <Card><CardContent className="p-8 text-center">Chargement de la vue {niveau}...</CardContent></Card>}
      {error && <Card className="border-destructive"><CardContent className="p-6 text-destructive">{error}</CardContent></Card>}

      {!loading && !error && tab === "dashboard" && dashboard && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card><CardHeader><CardDescription>Niveau actuel</CardDescription><CardTitle className="flex items-center gap-2"><GraduationCap />{dashboard.profil?.niveau_actuel}</CardTitle></CardHeader></Card>
            <Card><CardHeader><CardDescription>Devoirs en cours</CardDescription><CardTitle className="flex items-center gap-2"><BookOpen />{dashboard.devoirs?.en_cours ?? 0}</CardTitle></CardHeader></Card>
            <Card><CardHeader><CardDescription>Taux de reussite</CardDescription><CardTitle className="flex items-center gap-2"><Gauge />{dashboard.profil?.taux_reussite_global ?? 0}%</CardTitle></CardHeader></Card>
          </div>
          <Card>
            <CardHeader><CardTitle>Competences</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {(["co", "ce", "ee", "eo"] as const).map((code) => (
                <div key={code} className="rounded-lg bg-muted p-4 text-center">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">{code}</p>
                  <p className="text-2xl font-bold">{dashboard.profil?.[`niveau_${code}`]}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      {!loading && !error && tab === "devoirs" && (
        <div className="grid gap-3">
          {devoirs.length === 0 && <Card><CardContent className="p-8 text-center text-muted-foreground">Aucun devoir sandbox pour ce profil.</CardContent></Card>}
          {devoirs.map((devoir) => (
            <Card key={devoir.id}>
              <CardHeader className="flex-row items-center gap-4">
                <div className="flex-1">
                  <CardTitle className="text-lg">{devoir.exercice?.titre ?? "Exercice"}</CardTitle>
                  <CardDescription>{devoir.exercice?.competence} - {devoir.statut}</CardDescription>
                </div>
                <Button
                  disabled={!["en_attente", "expire"].includes(devoir.statut)}
                  onClick={() => void openDevoir(devoir.id)}
                >
                  <PlayCircle className="mr-2 h-4 w-4" />
                  Tester
                </Button>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
