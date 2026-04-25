import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { updateProfilEleve } from "@/lib/updateProfilEleve";
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
  ArrowLeft, CheckCircle2, XCircle, Loader2, Send, FileText, Mic, Square, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import TTSAudioPlayer from "@/components/ui/TTSAudioPlayer";
import CorrectionDetaillee from "@/components/CorrectionDetaillee";
import ReportProblemButton from "@/components/ReportProblemButton";
import { evaluerReponseIA } from "@/lib/testPositionnement";
import { Progress } from "@/components/ui/progress";
import {
  getMicrophoneErrorMessage,
  requestMicrophoneStream,
  startWavRecording,
} from "@/lib/audioRecorder";

function CorrectionAccordion({ correction }: { correction: any[] }) {
  const [openItems, setOpenItems] = useState<number[]>([]);
  const toggleItem = (i: number) =>
    setOpenItems(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Correction détaillée</h2>
      {correction.map((c: any, i: number) => (
        <Card key={i} className={cn("border-l-4", c.correct ? "border-l-green-500" : "border-l-destructive")}>
          <CardContent className="py-3 px-4">
            {/* NIVEAU 1 — toujours visible */}
            <div className="flex items-start gap-2">
              {c.correct
                ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                : <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />}
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">{c.question}</p>
                {!c.correct && (
                  <>
                    <p className="text-xs text-destructive">Ta réponse : {c.reponse_eleve || "—"}</p>
                    <p className="text-xs text-green-600 font-medium">Bonne réponse : {c.bonne_reponse}</p>
                  </>
                )}
              </div>
              {(c.explication || c.justification_pedagogique || c.reformulation_modele) && (
                <button
                  onClick={() => toggleItem(i)}
                  className="text-xs text-primary underline shrink-0 mt-0.5"
                >
                  {openItems.includes(i) ? "Masquer" : "Voir l'explication"}
                </button>
              )}
            </div>

            {/* Reformulation modèle — toujours visible pour EO */}
            {c.reformulation_modele && (
              <div className="mt-2 p-2.5 rounded-md bg-blue-50 border border-blue-200 dark:bg-blue-950/30 dark:border-blue-800 text-sm">
                <p className="text-blue-800 dark:text-blue-300">
                  💡 <strong>Ce que tu aurais pu dire :</strong> « {c.reformulation_modele} »
                </p>
              </div>
            )}

            {/* NIVEAU 2 — accordéon */}
            {openItems.includes(i) && (
              <div className="mt-3 pt-3 border-t space-y-2 text-sm">
                {c.explication && <p className="text-muted-foreground">{c.explication}</p>}
                {c.reformulation_modele && (
                  <p className="text-emerald-700 dark:text-emerald-400">
                    ✏️ <strong>À retenir :</strong> « {c.reformulation_modele} »
                  </p>
                )}
                {c.encouragement && (
                  <p className="text-amber-700 dark:text-amber-400 font-medium">💪 {c.encouragement}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

const DevoirPassation = () => {
  const { devoirId } = useParams<{ devoirId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; correction: any[]; bilanId?: string } | null>(null);

  // Audio recording state for EO
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Forced-listen state for CO
  const [hasListened, setHasListened] = useState(false);

  // Timer state
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timerWarning, setTimerWarning] = useState(false);
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Live attempt tracking — pour le suivi en direct du formateur
  const liveAttemptIdRef = useRef<string | null>(null);
  const lastSyncedAnswersRef = useRef<string>("");

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
  const metadata = contenu?.metadata;
  const timeLimit = metadata?.time_limit_seconds || contenu?.time_limit_seconds || 0;

  const isCompetenceCO = ex?.competence === "CO";
  const isCompetenceEO = ex?.competence === "EO" || contenu?.type_reponse === "oral" || ex?.format === "production_orale";
  const scriptAudio = contenu?.script_audio;

  // Timer logic
  useEffect(() => {
    if (!devoir || isDone || result || !timeLimit) return;
    if (isCompetenceCO && !hasListened) return;
    timerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [devoir, isDone, result, timeLimit, isCompetenceCO, hasListened]);

  // Warning at time_limit, auto-submit at time_limit + 10
  useEffect(() => {
    if (!timeLimit) return;
    if (elapsedSeconds >= timeLimit && !timerWarning) {
      setTimerWarning(true);
      toast.warning("⏰ Temps dépassé !", {
        description: "Vous avez 10 secondes pour soumettre vos réponses. Le devoir va se fermer automatiquement.",
        duration: 10000,
      });
    }
    if (elapsedSeconds >= timeLimit + 10 && !autoSubmitted && !result) {
      setAutoSubmitted(true);
      if (timerRef.current) clearInterval(timerRef.current);
      toast.info("Soumission automatique des réponses.");
      if (isCompetenceEO) {
        if (audioBlob) handleSubmitOral();
      } else {
        handleSubmit();
      }
    }
  }, [elapsedSeconds, timeLimit, timerWarning, autoSubmitted, result]);

  // ─── LIVE SYNC: upsert exercise_attempts pendant la passation ───
  // Permet au formateur de voir en direct l'avancement de l'élève.
  const syncLiveAttempt = useCallback(async (force = false) => {
    if (!ex?.id || !user?.id || result || isDone) return;
    const snapshot = JSON.stringify(answers);
    if (!force && snapshot === lastSyncedAnswersRef.current) return;
    lastSyncedAnswersRef.current = snapshot;

    // Calcul score partiel + items répondus (QCM/texte uniquement)
    let answeredCount = 0;
    let correctCount = 0;
    const itemResults = items.map((item: any, idx: number) => {
      const userAnswer = answers[idx];
      if (userAnswer !== undefined && userAnswer !== "") {
        answeredCount++;
        const isCorrect =
          (userAnswer || "").trim().toLowerCase() ===
          (item.bonne_reponse || "").trim().toLowerCase();
        if (isCorrect) correctCount++;
        return { idx, answered: true, correct: isCorrect, reponse: userAnswer };
      }
      return { idx, answered: false };
    });
    const partialScore = items.length > 0 ? correctCount / items.length : 0;

    try {
      // Try update first (existing in_progress attempt)
      const { data: updated, error: updErr } = await supabase
        .from("exercise_attempts")
        .update({
          answers: answers as any,
          item_results: { items: itemResults, answered: answeredCount, total: items.length } as any,
          score_normalized: partialScore,
          source_app: "primo-live",
        })
        .eq("exercise_id", ex.id)
        .eq("learner_id", user.id)
        .eq("status", "in_progress")
        .select("id")
        .maybeSingle();

      if (updated?.id) {
        liveAttemptIdRef.current = updated.id;
        return;
      }
      if (updErr) console.warn("[live-sync] update warn:", updErr.message);

      // No row → insert
      const { data: inserted, error: insErr } = await supabase
        .from("exercise_attempts")
        .insert({
          exercise_id: ex.id,
          learner_id: user.id,
          status: "in_progress",
          answers: answers as any,
          item_results: { items: itemResults, answered: answeredCount, total: items.length } as any,
          score_normalized: partialScore,
          source_app: "primo-live",
          started_at: new Date().toISOString(),
        })
        .select("id")
        .maybeSingle();
      if (inserted?.id) liveAttemptIdRef.current = inserted.id;
      else if (insErr) console.warn("[live-sync] insert warn:", insErr.message);
    } catch (e) {
      console.warn("[live-sync] error", e);
    }
  }, [ex?.id, user?.id, answers, items, result, isDone]);

  // Sync immédiat à chaque changement de réponse (debounce léger)
  useEffect(() => {
    if (!ex?.id || result || isDone) return;
    const t = setTimeout(() => syncLiveAttempt(false), 800);
    return () => clearTimeout(t);
  }, [answers, ex?.id, result, isDone, syncLiveAttempt]);

  // Sync de sécurité toutes les 10s
  useEffect(() => {
    if (!ex?.id || result || isDone) return;
    const interval = setInterval(() => syncLiveAttempt(true), 10000);
    return () => clearInterval(interval);
  }, [ex?.id, result, isDone, syncLiveAttempt]);

  // Marque l'attempt comme completed au démontage si soumission non faite
  // (le trigger mirror_resultat_to_attempt s'occupe du cas soumission normale)

  // Audio recording helpers (WAV for cross-browser compatibility)
  const wavRecorderRef = useRef<{ stop: () => void } | null>(null);

  const startRecording = async () => {
    try {
      const stream = await requestMicrophoneStream();
      const recorder = startWavRecording(stream, (blob) => {
        setAudioBlob(blob);
      });
      wavRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (error) {
      console.error("Microphone access error:", error);
      toast.error(getMicrophoneErrorMessage(error));
    }
  };

  const stopRecording = () => {
    wavRecorderRef.current?.stop();
    wavRecorderRef.current = null;
    setIsRecording(false);
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        resolve(dataUrl.split(",")[1] || "");
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const triggerBilanGeneration = async (score: number, correction: any[]) => {
    try {
      if (!devoir || !user) return;
      const { data: profile } = await supabase.from("profiles").select("nom, prenom").eq("id", user.id).single();
      const eleveNom = profile ? `${profile.prenom} ${profile.nom}` : "Élève";
      let sessionTitle = "Séance";
      let sessionId: string | null = devoir.session_id;
      if (sessionId) {
        const { data: sess } = await supabase.from("sessions").select("titre").eq("id", sessionId).single();
        if (sess) sessionTitle = sess.titre;
      }
      const formateurId = devoir.formateur_id;
      const devoirResults = [{
        titre: ex?.titre || "Exercice",
        competence: ex?.competence || "CE",
        score,
        erreurs: correction.filter((c: any) => !c.correct).map((c: any) => c.question).join("; "),
      }];
      const { data: bilanData, error: bilanErr } = await supabase.functions.invoke("generate-post-devoir-bilan", {
        body: { eleveNom, bilanTestScore: { score }, devoirResults, sessionTitle },
      });
      if (bilanErr || bilanData?.error) {
        console.error("Bilan generation failed:", bilanErr || bilanData?.error);
        return;
      }
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

  const handleSubmitOral = useCallback(async () => {
    if (!devoir || !ex || !user || !audioBlob) return;
    setSubmitting(true);
    try {
      // Upload audio to storage
      const path = `devoirs/${devoirId}/${user.id}.wav`;
      await supabase.storage.from("test-audio").upload(path, audioBlob, { contentType: "audio/wav", upsert: true });

      // Transcribe
      let transcription = "(Transcription échouée - Audio illisible)";
      try {
        const base64Data = await blobToBase64(audioBlob);
        const { data: sttData, error: sttError } = await supabase.functions.invoke("tcf-process-audio", {
          body: { action: "stt", audioBase64: base64Data },
        });
        if (sttError || !sttData?.transcript) {
          toast.error("Serveur vocal indisponible", { description: "Veuillez réessayer." });
          setSubmitting(false);
          return;
        }
        transcription = sttData.transcript;
      } catch (sttErr) {
        console.error("STT error:", sttErr);
        toast.error("Serveur vocal indisponible", { description: "Veuillez réessayer." });
        setSubmitting(false);
        return;
      }

      // AI evaluation with metadata for high tolerance
      const evaluation = await evaluerReponseIA(
        { criteres_evaluation: contenu?.criteres_evaluation || { prononciation: "clarté", vocabulaire: "pertinence", grammaire: "correction", coherence: "logique" } },
        transcription,
        {
          code: metadata?.code,
          type_reponse: "oral",
          mots_cles_attendus: contenu?.mots_cles_attendus,
        }
      );

      const score = Math.round((evaluation.score / 3) * 100);
      const correction = [{
        question: ex.consigne || "Production orale",
        reponse_eleve: transcription,
        bonne_reponse: "(Évaluation IA)",
        correct: score >= 60,
        explication: evaluation.justification,
      }];

      // Insert result
      await supabase.from("resultats").insert({
        eleve_id: user.id,
        exercice_id: ex.id,
        devoir_id: devoirId!,
        score,
        reponses_eleve: { transcription, audio_path: path } as any,
        correction_detaillee: correction as any,
        tentative: 1,
      });

      // Update devoir status
      const newConsecutive = (devoir.nb_reussites_consecutives || 0) + (score >= 80 ? 1 : 0);
      const newStatut = newConsecutive >= 2 ? "arrete" : "fait";
      await supabase.from("devoirs").update({
        statut: newStatut as any,
        nb_reussites_consecutives: score >= 80 ? newConsecutive : 0,
        updated_at: new Date().toISOString(),
      }).eq("id", devoirId!);

      try { await updateProfilEleve(user.id, ex?.niveau_vise || "A1"); } catch {}

      const oralPriorite = (correction[0] as any)?.priorite_remediation;
      if (oralPriorite) {
        try {
          await supabase.rpc("update_priorites_pedagogiques", {
            p_eleve_id: user.id,
            p_nouvelle_priorite: oralPriorite,
          });
        } catch (e) { console.error("Priority update error:", e); }
      }

      const bilanId = await triggerBilanGeneration(score, correction);

      setResult({ score, correction, bilanId });
      qc.invalidateQueries({ queryKey: ["eleve-devoirs"] });
      qc.invalidateQueries({ queryKey: ["devoir-detail", devoirId] });
      toast.success(`Devoir oral soumis ! Score : ${score}%`);
    } catch (e: any) {
      toast.error("Erreur de soumission", { description: e.message });
    } finally {
      setSubmitting(false);
    }
  }, [devoir, ex, user, audioBlob, devoirId, contenu, metadata]);

  const handleSubmit = useCallback(async () => {
    if (!devoir || !ex || !user) return;
    setSubmitting(true);
    try {
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

      const newConsecutive = (devoir.nb_reussites_consecutives || 0) + (score >= 80 ? 1 : 0);
      const newStatut = newConsecutive >= 2 ? "arrete" : "fait";
      const { error: devErr } = await supabase.from("devoirs").update({
        statut: newStatut as any,
        nb_reussites_consecutives: score >= 80 ? newConsecutive : 0,
        updated_at: new Date().toISOString(),
      }).eq("id", devoirId!);
      if (devErr) throw devErr;

      try { await updateProfilEleve(user.id, ex?.niveau_vise || "A1"); } catch {}

      const qcmPriorite = (correction[correction.length - 1] as any)?.priorite_remediation;
      if (qcmPriorite) {
        try {
          await supabase.rpc("update_priorites_pedagogiques", {
            p_eleve_id: user.id,
            p_nouvelle_priorite: qcmPriorite,
          });
        } catch (e) { console.error("Priority update error:", e); }
      }

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
  }, [devoir, ex, user, items, answers, devoirId]);

  // Format timer display
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const timerProgress = timeLimit ? Math.min(100, (elapsedSeconds / timeLimit) * 100) : 0;

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

        <CorrectionDetaillee
          itemResults={finalResult.correction}
          scoreNormalized={finalResult.score}
        />

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

  // Check if CO questions are locked behind listening
  const coLocked = isCompetenceCO && scriptAudio && !hasListened;

  // ─── Exercise Passation ───
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/eleve/devoirs")} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{ex?.titre}</h1>
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">{ex?.competence} · {ex?.format?.replace(/_/g, " ")}</p>
            {metadata?.code && (
              <Badge variant="outline" className="text-xs">{metadata.code}</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Timer bar */}
      {timeLimit > 0 && (
        <Card className={cn(
          "transition-all duration-300",
          timerWarning ? "border-orange-500 animate-pulse" : "border-muted"
        )}>
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Clock className={cn("h-4 w-4", timerWarning ? "text-orange-500" : "text-muted-foreground")} />
                <span className={cn("text-sm font-mono font-bold", timerWarning ? "text-orange-500" : "text-foreground")}>
                  {formatTime(elapsedSeconds)}
                </span>
              </div>
              <span className={cn("text-xs", timerWarning ? "text-orange-500 font-semibold" : "text-muted-foreground")}>
                {timerWarning ? "⚠️ Temps dépassé !" : `Limite : ${formatTime(timeLimit)}`}
              </span>
            </div>
            <Progress
              value={timerProgress}
              className={cn("h-2", timerWarning ? "[&>div]:bg-orange-500" : "")}
            />
          </CardContent>
        </Card>
      )}

      {timerWarning && (
        <div className="bg-destructive text-destructive-foreground text-center py-3 px-4 rounded-lg font-bold text-base animate-pulse">
          ⏰ Temps dépassé — soumission automatique dans quelques secondes
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Consigne</CardTitle>
          <TTSAudioPlayer
            text={ex?.consigne || ""}
            label="🔊 Écouter la consigne"
            autoPlay={false}
            className="mb-2"
          />
          <CardDescription>{ex?.consigne}</CardDescription>
        </CardHeader>
      </Card>

      {/* TTS player for CO exercises — forced listen */}
      {isCompetenceCO && scriptAudio && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">🔊 Écoute audio</p>
            <TTSAudioPlayer
              text={scriptAudio}
              className="mb-0"
              onPlayComplete={() => setHasListened(true)}
            />
            {!hasListened && (
              <p className="text-xs text-orange-600 mt-2 font-medium">
                ⚠️ Vous devez écouter l'audio au moins une fois avant de répondre.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Image support for CE exercises */}
      {(() => {
        const raw = contenu?.image || contenu?.image_url || contenu?.visual || contenu?.support_visuel || contenu?.illustration || contenu?.media_url;
        const imageUrl = raw && typeof raw === "string" && (raw.startsWith("http://") || raw.startsWith("https://")) ? raw : null;
        return imageUrl ? (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">🖼️ Document visuel</p>
              <img src={String(imageUrl)} alt="Support visuel de l'exercice" className="max-w-full rounded-lg mx-auto" />
            </CardContent>
          </Card>
        ) : null;
      })()}

      {/* Text support for CE or non-CO with texte */}
      {!isCompetenceCO && contenu?.texte && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">📄 Support de l'exercice</p>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{contenu.texte}</p>
          </CardContent>
        </Card>
      )}

      {/* EO: Oral recording interface */}
      {isCompetenceEO ? (
        <Card>
          <CardContent className="pt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Enregistrez votre réponse orale en cliquant sur le microphone ci-dessous.
            </p>

            <div className="flex items-center gap-3">
              {isRecording ? (
                <Button variant="destructive" onClick={stopRecording} className="gap-2">
                  <Square className="h-4 w-4" /> Arrêter l'enregistrement
                </Button>
              ) : (
                <Button variant="outline" onClick={startRecording} className="gap-2">
                  <Mic className="h-4 w-4" /> {audioBlob ? "Réenregistrer" : "Enregistrer ma réponse"}
                </Button>
              )}
              {audioBlob && !isRecording && (
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Audio enregistré
                </Badge>
              )}
            </div>

            {audioBlob && (
              <audio controls src={URL.createObjectURL(audioBlob)} className="w-full mt-2" />
            )}

            <Button
              onClick={handleSubmitOral}
              disabled={submitting || !audioBlob}
              className="w-full gap-2"
              size="xxl"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {submitting ? "Transcription et évaluation en cours…" : "Soumettre ma réponse orale"}
            </Button>

            <div className="flex justify-center pt-2">
              <ReportProblemButton
                context="devoir"
                devoirId={devoir?.id}
                exerciceId={ex?.id}
                formateurId={devoir?.formateur_id}
                onReported={() => navigate("/eleve/devoirs")}
              />
            </div>
          </CardContent>
        </Card>
      ) : items.length > 0 ? (
        <div className={cn("space-y-4", coLocked && "opacity-50 pointer-events-none")}>
          {items.map((item: any, idx: number) => (
            <Card key={idx}>
              <CardContent className="pt-4 space-y-3">
                <p className="font-medium text-sm">
                  <span className="text-primary font-bold mr-2">Q{idx + 1}.</span>
                  {item.question}
                </p>
                {Array.isArray(item.options) && item.options.length > 0 ? (
                  <div className="space-y-2">
                    {item.options.map((opt: string, oi: number) => (
                      <button
                        key={oi}
                        className={cn(
                          "btn-reponse-eleve",
                          answers[idx] === opt && "selected"
                        )}
                        onClick={() => setAnswers((prev) => ({ ...prev, [idx]: opt }))}
                      >
                        <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm">
                          {String.fromCharCode(65 + oi)}
                        </span>
                        <span className="flex-1">{opt}</span>
                        <TTSAudioPlayer text={opt} size="icon" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <input
                    type="text"
                    className="w-full border-2 rounded-2xl px-6 py-4 text-lg bg-background min-h-14"
                    placeholder="Ta réponse..."
                    value={answers[idx] || ""}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [idx]: e.target.value }))}
                  />
                )}
              </CardContent>
            </Card>
          ))}

          <Button onClick={handleSubmit} disabled={submitting || coLocked} className="w-full gap-2" size="xxl">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Soumettre mes réponses
          </Button>

          <div className="flex justify-center pt-2">
            <ReportProblemButton
              context="devoir"
              devoirId={devoir?.id}
              exerciceId={ex?.id}
              formateurId={devoir?.formateur_id}
              onReported={() => navigate("/eleve/devoirs")}
            />
          </div>
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground">
            Aucune question dans cet exercice.
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DevoirPassation;
