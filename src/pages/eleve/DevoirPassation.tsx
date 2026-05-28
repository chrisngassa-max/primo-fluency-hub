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
  ArrowLeft, CheckCircle2, XCircle, Loader2, Send, FileText, Mic, Square, Clock, Smile, Meh, Frown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import TTSAudioPlayer from "@/components/ui/TTSAudioPlayer";
import CorrectionDetaillee from "@/components/CorrectionDetaillee";
import ReportProblemButton from "@/components/ReportProblemButton";
import RegenerateItemButton from "@/components/RegenerateItemButton";
import SmartText from "@/components/SmartText";
import SmartTextHint from "@/components/SmartTextHint";
import { evaluerReponseIA } from "@/lib/testPositionnement";
import { Progress } from "@/components/ui/progress";
import {
  getMicrophoneErrorMessage,
  requestMicrophoneStream,
  startWavRecording,
} from "@/lib/audioRecorder";
import { useLiveAttemptSync } from "@/hooks/useLiveAttemptSync";
import { emitLiveEvent } from "@/lib/liveEventEmitter";
import { corrigerExercice } from "@/lib/correctionExercice";
import { applyExerciseVariant, resolveStudentExerciseLevel } from "@/lib/exerciseVariant";
import InterventionPlayer from "@/components/eleve/InterventionPlayer";

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

type DifficultyFelt = "facile" | "correct" | "trop_difficile";

function DevoirFeedbackCard({
  devoirId,
  eleveId,
  exerciceId,
  score,
}: {
  devoirId: string;
  eleveId: string;
  exerciceId: string | null;
  score: number;
}) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState<DifficultyFelt | null>(null);

  const { data: feedback } = useQuery({
    queryKey: ["devoir-feedback", devoirId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("devoir_feedback")
        .select("difficulty_felt")
        .eq("devoir_id", devoirId)
        .eq("eleve_id", eleveId)
        .maybeSingle();
      if (error) throw error;
      return data as { difficulty_felt: DifficultyFelt } | null;
    },
    enabled: !!devoirId && !!eleveId,
  });

  const current = feedback?.difficulty_felt ?? null;

  const handleSelect = async (choice: DifficultyFelt) => {
    setSaving(choice);
    try {
      const { error } = await supabase
        .from("devoir_feedback")
        .upsert(
          {
            devoir_id: devoirId,
            eleve_id: eleveId,
            exercice_id: exerciceId,
            score,
            difficulty_felt: choice,
          },
          { onConflict: "devoir_id,eleve_id" },
        );
      if (error) throw error;
      toast.success("Merci pour ton retour !");
      qc.invalidateQueries({ queryKey: ["devoir-feedback", devoirId] });
    } catch (e: any) {
      toast.error("Erreur d'enregistrement", { description: e.message });
    } finally {
      setSaving(null);
    }
  };

  const options: { value: DifficultyFelt; label: string; Icon: typeof Smile }[] = [
    { value: "facile", label: "Facile", Icon: Smile },
    { value: "correct", label: "Correct", Icon: Meh },
    { value: "trop_difficile", label: "Trop difficile", Icon: Frown },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Comment c'était pour toi ?</CardTitle>
        <CardDescription>Ton retour aide à adapter les prochains devoirs.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2">
          {options.map(({ value, label, Icon }) => {
            const selected = current === value;
            return (
              <Button
                key={value}
                variant={selected ? "default" : "outline"}
                onClick={() => handleSelect(value)}
                disabled={saving !== null}
                className="flex-col h-auto py-3 gap-1.5"
              >
                {saving === value
                  ? <Loader2 className="h-5 w-5 animate-spin" />
                  : <Icon className="h-5 w-5" />}
                <span className="text-xs font-medium">{label}</span>
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
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
  const [itemOverrides, setItemOverrides] = useState<Record<number, any>>({});
  const [reportedItemIdx, setReportedItemIdx] = useState<Set<number>>(new Set());

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

  // Sprint 6 — notification intervention_recue du formateur
  const [interventionNotif, setInterventionNotif] = useState<{
    titre: string; contenu_texte: string; audio_url: string | null;
  } | null>(null);
  const interventionAudioRef = useRef<HTMLAudioElement | null>(null);

  // Live attempt tracking — extrait dans useLiveAttemptSync (voir plus bas)
  const { data: devoir, isLoading } = useQuery({
    queryKey: ["devoir-detail", devoirId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("devoirs")
        .select("*, exercice:exercices(id, titre, consigne, competence, format, contenu, niveau_vise, variante_niveau_bas, variante_niveau_haut)")
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

  // Choix de variante adaptée à l'élève (fallback transparent si absente)
  const { data: targetLevel } = useQuery({
    queryKey: ["devoir-variant-level", devoirId, user?.id],
    queryFn: async () =>
      resolveStudentExerciseLevel({
        eleveId: user!.id,
        sessionId: (devoir as any)?.session_id ?? null,
        sourceLabel: (devoir as any)?.source_label ?? null,
      }),
    enabled: !!devoir && !!user?.id,
  });

  const rawEx = (devoir as any)?.exercice;
  const variant = rawEx
    ? applyExerciseVariant(rawEx, targetLevel ?? "standard")
    : { consigne: "", contenu: {}, appliedLevel: "standard" as const };
  const ex = rawEx
    ? { ...rawEx, consigne: variant.consigne, contenu: variant.contenu }
    : rawEx;
  const contenu = ex?.contenu as any;
  const rawItems: any[] = contenu?.items ?? [];
  const items: any[] = rawItems.map((it, idx) => itemOverrides[idx] ? { ...it, ...itemOverrides[idx] } : it);
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
  // Permet au formateur de voir en direct l'avancement de l'élève via Realtime.
  // Emission live : exercice_demarre quand le devoir est chargé et lié à une séance
  useEffect(() => {
    const sessionId = (devoir as any)?.session_id as string | null;
    if (!sessionId || !user?.id || !ex?.id || result || isDone) return;
    emitLiveEvent({
      sessionId,
      eleveId: user.id,
      eventType: "exercice_demarre",
      payload: { exercice_id: ex.id, competence: ex.competence },
    });
  // Déclenché une seule fois quand ex est disponible
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ex?.id, (devoir as any)?.session_id, user?.id]);

  // Sprint 6 — écoute les intervention_recue du formateur en temps réel
  useEffect(() => {
    const sessionId = (devoir as any)?.session_id as string | null;
    if (!sessionId || !user?.id) return;

    const ch = supabase
      .channel(`intervention-${sessionId}-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "session_live_events",
          filter: `session_id=eq.${sessionId}`,
        },
        (ev) => {
          const row = ev.new as any;
          if (row.event_type !== "intervention_recue") return;
          if (row.eleve_id !== user.id) return;
          const p = row.payload ?? {};
          setInterventionNotif({
            titre: p.titre ?? "Message du formateur",
            contenu_texte: p.contenu_texte ?? "",
            audio_url: p.audio_url ?? null,
          });
          if (p.audio_url) {
            interventionAudioRef.current?.pause();
            interventionAudioRef.current = new Audio(p.audio_url);
            interventionAudioRef.current.play().catch(() => {});
          }
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(devoir as any)?.session_id, user?.id]);

  // La finalisation "completed" est gérée par le trigger mirror_resultat_to_attempt
  // lors de l'insert dans `resultats`.
  useLiveAttemptSync({
    exerciseId: ex?.id ?? null,
    learnerId: user?.id ?? null,
    answers,
    items,
    disabled: !!result || !!isDone,
    sourceApp: "primo-live",
  });

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
      const sessionId: string | null = devoir.session_id;
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

      // VAGUE 2 : la correction et l'écriture du score sont déléguées au serveur.
      // Le client envoie uniquement la transcription brute. La fonction
      // submit-devoir-result correspond à un seul item production_orale.
      const { data: serverResult, error: submitErr } = await supabase.functions.invoke(
        "submit-devoir-result",
        {
          body: {
            devoir_id: devoirId!,
            answers: { 0: transcription },
            transcription,
            audio_path: path,
          },
        }
      );
      if (submitErr || !serverResult) {
        throw new Error(submitErr?.message || "Soumission serveur échouée");
      }
      const score = serverResult.score as number;
      const correction = serverResult.correction_detaillee as any[];
      const newStatut = serverResult.devoir_statut as string;

      try { await updateProfilEleve(user.id, ex?.niveau_vise || "A1"); } catch (e) { console.error(e); }

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

      const sessionId = (devoir as any)?.session_id as string | null;
      if (sessionId && user?.id) {
        void emitLiveEvent({
          sessionId,
          eleveId: user.id,
          eventType: "exercice_termine",
          payload: { score, exercice_id: ex?.id },
        });
      }
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
      // VAGUE 2 : tout passe par submit-devoir-result. Le client n'écrit plus
      // ni dans `resultats`, ni dans `devoirs.statut/score`.
      const { data: serverResult, error: submitErr } = await supabase.functions.invoke(
        "submit-devoir-result",
        {
          body: {
            devoir_id: devoirId!,
            answers,
          },
        }
      );
      if (submitErr || !serverResult) {
        throw new Error(submitErr?.message || "Soumission serveur échouée");
      }
      const score = serverResult.score as number;
      const correction = serverResult.correction_detaillee as any[];
      const aiFailed = serverResult.ai_failed as boolean;
      if (aiFailed) {
        toast.warning("Évaluation IA partielle", {
          description: "Certains items seront revus par ton formateur.",
        });
      }

      try { await updateProfilEleve(user.id, ex?.niveau_vise || "A1"); } catch (e) { console.error(e); }

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

      // exercice_termine côté client — classification + reponse_incorrecte/correcte
      // sont désormais émis server-side dans submit-devoir-result (Sprint 3).
      const sessionId = (devoir as any)?.session_id as string | null;
      if (sessionId && user?.id) {
        void emitLiveEvent({
          sessionId,
          eleveId: user.id,
          eventType: "exercice_termine",
          payload: { score, exercice_id: ex?.id },
        });
      }
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

        {user?.id && devoirId && (
          <DevoirFeedbackCard
            devoirId={devoirId}
            eleveId={user.id}
            exerciceId={ex?.id ?? null}
            score={finalResult.score}
          />
        )}

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
      <InterventionPlayer sessionId={(devoir as any)?.session_id ?? null} />
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

      {user?.id && <SmartTextHint />}

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
          <CardDescription>
            {user?.id ? (
              <SmartText text={ex?.consigne || ""} studentId={user.id} />
            ) : ex?.consigne}
          </CardDescription>
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
            <p className="text-sm whitespace-pre-wrap leading-relaxed">
              {user?.id ? (
                <SmartText text={contenu.texte} studentId={user.id} contextSentence={contenu.texte} />
              ) : contenu.texte}
            </p>
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
                  {user?.id ? (
                    <SmartText text={item.question} studentId={user.id} contextSentence={contenu?.texte || item.question} />
                  ) : item.question}
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
                <div className="flex justify-end pt-1">
                  {reportedItemIdx.has(idx) ? (
                    <Badge variant="outline" className="text-xs text-destructive border-destructive/40">
                      ⚠️ Question neutralisée
                    </Badge>
                  ) : (
                    <RegenerateItemButton
                      competence={ex.competence}
                      format={ex.format}
                      niveau={ex.niveau_vise || "A1"}
                      consigne={ex.consigne}
                      currentItem={{
                        question: item.question,
                        options: item.options,
                        bonne_reponse: item.bonne_reponse,
                        explication: item.explication,
                      }}
                      currentSupport={{
                        texte_support: contenu?.texte || contenu?.texte_support,
                        script_audio: scriptAudio,
                      }}
                      onRegenerated={(newItem) => {
                        setItemOverrides((prev) => ({ ...prev, [idx]: newItem }));
                        setAnswers((prev) => {
                          const { [idx]: _, ...rest } = prev;
                          return rest;
                        });
                      }}
                      onFallback={() => {
                        setReportedItemIdx((prev) => new Set(prev).add(idx));
                      }}
                      reportContext={{
                        context: "devoir",
                        devoirId: devoir?.id,
                        exerciceId: ex?.id,
                        formateurId: (devoir as any)?.formateur_id,
                        itemIndex: idx,
                      }}
                    />
                  )}
                </div>
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

      {/* Sprint 6 — notification intervention du formateur */}
      {interventionNotif && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 pointer-events-none">
          <div className="pointer-events-auto w-full max-w-sm rounded-xl border-2 border-primary/30 bg-card shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-start gap-3 p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-3 3v-3z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-primary">{interventionNotif.titre}</p>
                <p className="mt-1 text-sm text-foreground leading-relaxed">{interventionNotif.contenu_texte}</p>
                {interventionNotif.audio_url && (
                  <p className="mt-1.5 text-[11px] text-muted-foreground">🔊 Audio en cours de lecture…</p>
                )}
              </div>
              <button
                className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  interventionAudioRef.current?.pause();
                  setInterventionNotif(null);
                }}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DevoirPassation;
