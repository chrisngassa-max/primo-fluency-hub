import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  ArrowLeft, CheckCircle2, XCircle, Loader2, Send, FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

const DevoirPassation = () => {
  const { devoirId } = useParams<{ devoirId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; correction: any[]; bilanId?: string } | null>(null);

  const { data: devoir, isLoading } = useQuery({
    queryKey: ["devoir-detail", devoirId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("devoirs")
        .select("*, exercice:exercices(id, titre, consigne, competence, format, contenu, niveau_vise)")
        .eq("id", devoirId!)
        .eq("eleve_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!devoirId && !!user?.id,
  });

  // Check if already submitted
  const { data: existingResult } = useQuery({
    queryKey: ["devoir-result", devoirId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resultats")
        .select("*")
        .eq("devoir_id", devoirId!)
        .eq("eleve_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!devoirId && !!user?.id,
  });

  const ex = (devoir as any)?.exercice;
  const contenu = ex?.contenu as any;
  const items: any[] = contenu?.items ?? [];
  const isDone = devoir?.statut === "fait" || devoir?.statut === "arrete";

  const triggerBilanGeneration = async (score: number, correction: any[]) => {
    try {
      if (!devoir || !user) return;

      // Get student name
      const { data: profile } = await supabase.from("profiles").select("nom, prenom").eq("id", user.id).single();
      const eleveNom = profile ? `${profile.prenom} ${profile.nom}` : "Élève";

      // Get session info if available
      let sessionTitle = "Séance";
      let sessionId: string | null = devoir.session_id;
      if (sessionId) {
        const { data: sess } = await supabase.from("sessions").select("titre").eq("id", sessionId).single();
        if (sess) sessionTitle = sess.titre;
      }

      // Get formateur ID
      const formateurId = devoir.formateur_id;

      // Build devoir results for the AI
      const devoirResults = [{
        titre: ex?.titre || "Exercice",
        competence: ex?.competence || "CE",
        score,
        erreurs: correction.filter((c: any) => !c.correct).map((c: any) => c.question).join("; "),
      }];

      // Call AI to generate both bilans
      const { data: bilanData, error: bilanErr } = await supabase.functions.invoke("generate-post-devoir-bilan", {
        body: { eleveNom, bilanTestScore: { score }, devoirResults, sessionTitle },
      });

      if (bilanErr || bilanData?.error) {
        console.error("Bilan generation failed:", bilanErr || bilanData?.error);
        return;
      }

      // Store bilan in database
      const { data: inserted, error: insertErr } = await supabase.from("bilan_post_devoirs").insert({
        eleve_id: user.id,
        formateur_id: formateurId,
        session_id: sessionId,
        analyse_data: bilanData as any,
        is_read: false,
        is_integrated: false,
      }).select("id").single();

      if (insertErr) {
        console.error("Failed to save bilan:", insertErr);
        return;
      }

      // Send notification to formateur
      await supabase.from("notifications").insert({
        user_id: formateurId,
        titre: `${eleveNom} a rendu ses devoirs`,
        message: `Score global : ${score}% · ${correction.filter((c: any) => !c.correct).length} erreur(s) détectée(s)`,
        link: `/formateur/monitoring`,
      });

      return inserted?.id;
    } catch (e) {
      console.error("Bilan trigger error:", e);
    }
  };

  const handleSubmit = async () => {
    if (!devoir || !ex || !user) return;
    setSubmitting(true);
    try {
      // Calculate score
      let correct = 0;
      const correction = items.map((item: any, idx: number) => {
        const userAnswer = answers[idx] || "";
        const isCorrect = userAnswer.trim().toLowerCase() === (item.bonne_reponse || "").trim().toLowerCase();
        if (isCorrect) correct++;
        return {
          question: item.question,
          reponse_eleve: userAnswer,
          bonne_reponse: item.bonne_reponse,
          correct: isCorrect,
          explication: item.explication || "",
        };
      });

      const score = items.length > 0 ? Math.round((correct / items.length) * 100) : 0;

      // Insert result
      const { error: resErr } = await supabase.from("resultats").insert({
        eleve_id: user.id,
        exercice_id: ex.id,
        devoir_id: devoirId!,
        score,
        reponses_eleve: answers as any,
        correction_detaillee: correction as any,
        tentative: 1,
      });
      if (resErr) throw resErr;

      // Update devoir status
      const newConsecutive = (devoir.nb_reussites_consecutives || 0) + (score >= 80 ? 1 : 0);
      const newStatut = newConsecutive >= 2 ? "arrete" : "fait";

      const { error: devErr } = await supabase
        .from("devoirs")
        .update({
          statut: newStatut as any,
          nb_reussites_consecutives: score >= 80 ? newConsecutive : 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", devoirId!);
      if (devErr) throw devErr;

      // PROMPT C: Propagate score to profils_eleves
      try {
        const comp = ex?.competence || "CE";
        const compFieldMap: Record<string, string> = { CO: "taux_reussite_co", CE: "taux_reussite_ce", EE: "taux_reussite_ee", EO: "taux_reussite_eo", Structures: "taux_reussite_structures" };
        const field = compFieldMap[comp];
        if (field) {
          const profilUpdate: Record<string, any> = { eleve_id: user.id, [field]: score, taux_reussite_global: score, niveau_actuel: ex?.niveau_vise || "A1", updated_at: new Date().toISOString() };
          await supabase.from("profils_eleves").upsert(profilUpdate, { onConflict: "eleve_id" });
        }
      } catch (profileErr) {
        console.error("Profile update failed:", profileErr);
      }

      // Trigger AI bilan generation in background
      const bilanId = await triggerBilanGeneration(score, correction);

      setResult({ score, correction, bilanId });
      qc.invalidateQueries({ queryKey: ["eleve-devoirs"] });
      qc.invalidateQueries({ queryKey: ["devoir-detail", devoirId] });
      toast.success(`Devoir soumis ! Score : ${score}%`);
    } catch (e: any) {
      toast.error("Erreur de soumission", { description: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!devoir) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <p className="text-muted-foreground">Devoir introuvable.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/eleve/devoirs")}>
          <ArrowLeft className="h-4 w-4 mr-2" />Retour
        </Button>
      </div>
    );
  }

  // Show existing result if already done
  const showResult = result || (existingResult ? { score: Number(existingResult.score), correction: (existingResult.correction_detaillee as any) || [] } : null);

  if (showResult || isDone) {
    const finalResult = showResult || { score: 0, correction: [] };
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/eleve/devoirs")} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Retour
          </Button>
          <div>
            <h1 className="text-xl font-bold">Résultat — {ex?.titre}</h1>
            <p className="text-sm text-muted-foreground">{ex?.competence} · {ex?.format?.replace(/_/g, " ")}</p>
          </div>
        </div>

        <Card className={cn(
          "text-center",
          finalResult.score >= 80 ? "border-green-500/30" : finalResult.score >= 60 ? "border-orange-500/30" : "border-destructive/30"
        )}>
          <CardContent className="pt-6 pb-4">
            <p className={cn(
              "text-5xl font-black",
              finalResult.score >= 80 ? "text-green-600" : finalResult.score >= 60 ? "text-orange-600" : "text-destructive"
            )}>
              {finalResult.score}%
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {finalResult.score >= 80 ? "Excellent travail ! 🎉" : finalResult.score >= 60 ? "Bien, continuez vos efforts." : "Des révisions sont nécessaires."}
            </p>
          </CardContent>
        </Card>

        {/* Correction détaillée */}
        {Array.isArray(finalResult.correction) && finalResult.correction.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Correction détaillée</h2>
            {finalResult.correction.map((c: any, i: number) => (
              <Card key={i} className={cn(
                "border-l-4",
                c.correct ? "border-l-green-500" : "border-l-destructive"
              )}>
                <CardContent className="py-3 px-4 space-y-1">
                  <div className="flex items-start gap-2">
                    {c.correct ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{c.question}</p>
                      {!c.correct && (
                        <>
                          <p className="text-xs text-destructive">Votre réponse : {c.reponse_eleve || "—"}</p>
                          <p className="text-xs text-green-600">Bonne réponse : {c.bonne_reponse}</p>
                        </>
                      )}
                      {c.explication && (
                        <p className="text-xs text-muted-foreground italic">{c.explication}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Link to bilan if generated */}
        {(result as any)?.bilanId && (
          <Button variant="outline" className="w-full gap-2" onClick={() => navigate(`/eleve/bilan-devoirs/${(result as any).bilanId}`)}>
            <FileText className="h-4 w-4" />Voir mon bilan détaillé
          </Button>
        )}

        <Button variant="outline" className="w-full" onClick={() => navigate("/eleve/devoirs")}>
          <ArrowLeft className="h-4 w-4 mr-2" />Retour aux devoirs
        </Button>
      </div>
    );
  }

  // ─── Exercise Passation ───
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/eleve/devoirs")} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Button>
        <div>
          <h1 className="text-xl font-bold">{ex?.titre}</h1>
          <p className="text-sm text-muted-foreground">{ex?.competence} · {ex?.format?.replace(/_/g, " ")}</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Consigne</CardTitle>
          <CardDescription>{ex?.consigne}</CardDescription>
        </CardHeader>
      </Card>

      {items.length > 0 ? (
        <div className="space-y-4">
          {items.map((item: any, idx: number) => (
            <Card key={idx}>
              <CardContent className="pt-4 space-y-3">
                <p className="font-medium text-sm">
                  <span className="text-primary font-bold mr-2">Q{idx + 1}.</span>
                  {item.question}
                </p>
                {Array.isArray(item.options) && item.options.length > 0 ? (
                  <RadioGroup
                    value={answers[idx] || ""}
                    onValueChange={(val) => setAnswers((prev) => ({ ...prev, [idx]: val }))}
                  >
                    {item.options.map((opt: string, oi: number) => (
                      <div key={oi} className="flex items-center space-x-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                        <RadioGroupItem value={opt} id={`q${idx}-o${oi}`} />
                        <Label htmlFor={`q${idx}-o${oi}`} className="cursor-pointer flex-1 text-sm">
                          {opt}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                ) : (
                  <input
                    type="text"
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                    placeholder="Votre réponse..."
                    value={answers[idx] || ""}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [idx]: e.target.value }))}
                  />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground">
            Aucune question dans cet exercice.
          </CardContent>
        </Card>
      )}

      {items.length > 0 && (
        <Button onClick={handleSubmit} disabled={submitting} className="w-full gap-2" size="lg">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Soumettre mes réponses
        </Button>
      )}
    </div>
  );
};

export default DevoirPassation;
