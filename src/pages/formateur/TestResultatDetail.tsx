import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import {
  calculerProfilFinal,
  suggererGroupe,
  getProfilLabel,
} from "@/lib/testPositionnement";
import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, RefreshCw, Mic, CheckCircle } from "lucide-react";

const TestResultatDetail = () => {
  const { apprenantId } = useParams();
  const navigate = useNavigate();
  const [scoreOverrides, setScoreOverrides] = useState<
    Record<string, number | null>
  >({});

  // Get latest session for this student
  const { data: session } = useQuery({
    queryKey: ["test-session-detail", apprenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("test_sessions")
        .select("*")
        .eq("apprenant_id", apprenantId!)
        .eq("statut", "termine")
        .order("date_debut", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!apprenantId,
  });

  // Get student profile
  const { data: profile } = useQuery({
    queryKey: ["profile-detail", apprenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("nom, prenom")
        .eq("id", apprenantId!)
        .maybeSingle();
      return data;
    },
    enabled: !!apprenantId,
  });

  // Get all responses with questions
  const { data: reponses, refetch: refetchReponses } = useQuery({
    queryKey: ["test-reponses-detail", session?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("test_reponses")
        .select("*, test_questions:question_id(*)")
        .eq("session_id", session!.id)
        .order("date_reponse", { ascending: true });
      return data;
    },
    enabled: !!session?.id,
  });

  // Get result row
  const { data: resultat, refetch: refetchResultat } = useQuery({
    queryKey: ["test-resultat-row", session?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("test_resultats_apprenants")
        .select("*")
        .eq("session_id", session!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!session?.id,
  });

  useEffect(() => {
    if (reponses) {
      const overrides: Record<string, number | null> = {};
      reponses.forEach((r: any) => {
        overrides[r.id] = r.score_formateur;
      });
      setScoreOverrides(overrides);
    }
  }, [reponses]);

  const handleScoreChange = async (reponseId: string, score: number) => {
    setScoreOverrides((prev) => ({ ...prev, [reponseId]: score }));
    await supabase
      .from("test_reponses")
      .update({ score_formateur: score })
      .eq("id", reponseId);
    toast({ title: "Score mis à jour" });
  };

  const handleRecalculate = async () => {
    if (!reponses || !resultat) return;

    // Recalculate scores per competence using formateur scores where available
    const compScores: Record<string, number> = { co: 0, ce: 0, eo: 0, ee: 0 };
    const compMaxPalier: Record<string, number> = { co: 1, ce: 1, eo: 1, ee: 1 };

    reponses.forEach((r: any) => {
      const comp = r.competence.toLowerCase();
      const finalScore =
        scoreOverrides[r.id] ?? r.score_formateur ?? r.score_obtenu ?? 0;
      compScores[comp] = (compScores[comp] || 0) + finalScore;
      if (r.palier > (compMaxPalier[comp] || 0)) {
        compMaxPalier[comp] = r.palier;
      }
    });

    const paliers = {
      co: compMaxPalier.co,
      ce: compMaxPalier.ce,
      eo: compMaxPalier.eo,
      ee: compMaxPalier.ee,
    };

    const profil = calculerProfilFinal(paliers);
    const groupe = suggererGroupe(profil);

    await supabase
      .from("test_resultats_apprenants")
      .update({
        score_co: compScores.co,
        score_ce: compScores.ce,
        score_eo: compScores.eo,
        score_ee: compScores.ee,
        score_total: compScores.co + compScores.ce + compScores.eo + compScores.ee,
        palier_final_co: paliers.co,
        palier_final_ce: paliers.ce,
        palier_final_eo: paliers.eo,
        palier_final_ee: paliers.ee,
        profil,
        groupe_suggere: groupe,
      })
      .eq("id", resultat.id);

    toast({ title: "Profil recalculé", description: getProfilLabel(profil) });
    refetchResultat();
  };

  const handleConfirmGroupe = async (groupe: string) => {
    if (!resultat) return;
    await supabase
      .from("test_resultats_apprenants")
      .update({ groupe_confirme: groupe })
      .eq("id", resultat.id);
    toast({ title: "Groupe confirmé" });
    refetchResultat();
  };

  if (!session || !reponses) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const groupByCompetence = (comp: string) =>
    reponses.filter((r: any) => r.competence === comp);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Retour
        </Button>
        <h1 className="text-2xl font-bold">
          {profile?.prenom} {profile?.nom}
        </h1>
        {resultat?.profil && (
          <Badge>{getProfilLabel(resultat.profil)}</Badge>
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        <Button onClick={handleRecalculate} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Recalculer le profil
        </Button>
        <Select
          value={resultat?.groupe_confirme ?? ""}
          onValueChange={handleConfirmGroupe}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Confirmer le groupe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="groupe_1">Groupe 1</SelectItem>
            <SelectItem value="groupe_2">Groupe 2</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(["CO", "CE", "EO", "EE"] as const).map((comp) => {
        const items = groupByCompetence(comp);
        if (!items.length) return null;
        return (
          <Card key={comp}>
            <CardHeader>
              <CardTitle>{comp}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((r: any) => {
                const q = r.test_questions;
                const isQCM = q?.type_reponse === "qcm";
                const isOral = q?.type_reponse === "oral";
                const isEcrit = q?.type_reponse === "ecrit";

                return (
                  <div
                    key={r.id}
                    className="border rounded-lg p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-base">
                        {q?.consigne}
                      </p>
                      {isQCM && (
                        <Badge
                          variant={r.est_correct ? "default" : "destructive"}
                        >
                          {r.est_correct ? "Correct" : "Incorrect"}
                        </Badge>
                      )}
                    </div>

                    {isQCM && (
                      <div className="text-sm space-y-1">
                        <p>
                          <span className="text-muted-foreground">
                            Réponse :{" "}
                          </span>
                          {r.reponse_apprenant}
                        </p>
                        <p>
                          <span className="text-muted-foreground">
                            Bonne réponse :{" "}
                          </span>
                          {q?.reponse_correcte}
                        </p>
                      </div>
                    )}

                    {isOral && (
                      <div className="space-y-2">
                        {r.reponse_audio_url && (
                          <audio
                            controls
                            src={r.reponse_audio_url}
                            className="w-full"
                          />
                        )}
                        {r.reponse_apprenant && (
                          <p className="text-sm">
                            <span className="text-muted-foreground">
                              Transcription :{" "}
                            </span>
                            {r.reponse_apprenant}
                          </p>
                        )}
                      </div>
                    )}

                    {isEcrit && r.reponse_apprenant && (
                      <div className="bg-muted/50 rounded p-3 text-sm">
                        {r.reponse_apprenant}
                      </div>
                    )}

                    {(isOral || isEcrit) && (
                      <div className="space-y-2">
                        <div className="flex gap-4 items-center text-sm">
                          <span className="text-muted-foreground">
                            Score IA : {r.score_ia ?? "—"}/3
                          </span>
                          {r.justification_ia && (
                            <span className="text-muted-foreground italic">
                              {r.justification_ia}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-3 items-end flex-wrap">
                          <div className="space-y-1">
                            <Label className="text-xs">
                              Score formateur (0-3)
                            </Label>
                            <Input
                              type="number"
                              min={0}
                              max={3}
                              value={scoreOverrides[r.id] ?? ""}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                if (!isNaN(val) && val >= 0 && val <= 3) {
                                  handleScoreChange(r.id, val);
                                }
                              }}
                              className="w-20"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default TestResultatDetail;
