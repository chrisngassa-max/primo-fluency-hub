import { useState, useRef, useEffect, useCallback, useMemo } from "react";
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
  ArrowLeft, CheckCircle2, Loader2, Send, FileText, Mic, Square, Clock, Smile, Meh, Frown, BookOpen,
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
import LearnerAccessibilityToolbar from "@/components/eleve/LearnerAccessibilityToolbar";
import TranslatedInstruction from "@/components/eleve/TranslatedInstruction";
import {
  learnerTextSizeClass,
  remainingAudioPlays,
  type LearnerTextSize,
} from "@/lib/audioAccess";
import { qualitativeProgress } from "@/lib/qualitativeProgress";
import {
  deleteExerciseDraft,
  exerciseDraftKey,
  loadExerciseDraft,
  queueSubmission,
  saveExerciseDraft,
} from "@/lib/offlineExercise";
import { eeWordCountStatus, resolveEeMinWords } from "@/lib/eeWordCount";
import { RandomClickDetector } from "@/lib/randomClickDetector";
import { resolveLearningPathOutcome } from "@/lib/learningPath";

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
  const draftRestoredRef = useRef(false);

  // Audio recording state for EO
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [submittedOralTranscript, setSubmittedOralTranscript] = useState<string | null>(null);
  const [oralPlaybackUrl, setOralPlaybackUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Forced-listen state for CO
  const [hasListened, setHasListened] = useState(false);
  const [audioPlayCount, setAudioPlayCount] = useState(0);
  const [showTranscript, setShowTranscript] = useState(false);
  const [textSize, setTextSize] = useState<LearnerTextSize>(() => {
    const saved = localStorage.getItem("learner-text-size");
    return saved === "large" || saved === "extra-large" ? saved : "normal";
  });
  const [highContrast, setHighContrast] = useState(
    () => localStorage.getItem("learner-high-contrast") === "true"
  );

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
        .select("*, exercice:exercices(id, titre, consigne, competence, format, contenu, niveau_vise, variante_niveau_bas, variante_niveau_haut, metadata_code, metadata_skill, sous_competence, duree_limite_secondes, aides_disponibles, nombre_ecoutes_max, transcription_verrouillee, objectif_tcf, type_differenciation)")
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
  const lesson = contenu?.lesson as {
    title?: string;
    objective?: string;
    explanation?: string;
    key_points?: string[];
    examples?: string[];
    estimated_minutes?: number;
  } | null | undefined;
  const learningPath = metadata?.learning_path as {
    step_order?: number;
    step_count?: number;
    kind?: string;
    adaptive_policy?: {
      remediation_below?: number;
      consolidation_from?: number;
      extension_from?: number;
    };
  } | null | undefined;
  const timeLimit = ex?.duree_limite_secondes || metadata?.time_limit_seconds || contenu?.time_limit_seconds || 0;

  const isCompetenceCO = ex?.competence === "CO";
  const isCompetenceEO = ex?.competence === "EO" || contenu?.type_reponse === "oral" || ex?.format === "production_orale";
  const isCompetenceEE = ex?.competence === "EE" || ex?.format === "production_ecrite";
  const eeMinWords = useMemo(
    () => (isCompetenceEE ? resolveEeMinWords({
      consigne: ex?.consigne,
      metadataCode: ex?.metadata_code ?? metadata?.code,
      contenu,
    }) : null),
    [isCompetenceEE, ex?.consigne, ex?.metadata_code, metadata?.code, contenu],
  );
  const eeProductionText = useMemo(() => {
    if (!isCompetenceEE) return "";
    return Object.values(answers).filter((v) => typeof v === "string").join(" ");
  }, [isCompetenceEE, answers]);
  const eeWordStatus = useMemo(() => {
    if (!isCompetenceEE || eeMinWords == null) return null;
    return eeWordCountStatus(eeProductionText, eeMinWords);
  }, [isCompetenceEE, eeMinWords, eeProductionText]);
  const randomClickRef = useRef(new RandomClickDetector());
  const scriptAudio = contenu?.script_audio;
  const maxAudioPlays = ex?.nombre_ecoutes_max ?? metadata?.nombre_ecoutes_max ?? null;
  const transcriptLocked = ex?.transcription_verrouillee
    ?? metadata?.transcription_verrouillee
    ?? contenu?.transcription_verrouillee
    ?? false;
  const remainingPlays = remainingAudioPlays(audioPlayCount, maxAudioPlays);
  const draftKey = user?.id && devoirId ? exerciseDraftKey(user.id, devoirId) : null;
  useEffect(() => {
    if (!isCompetenceEO) {
      setOralPlaybackUrl(null);
      return;
    }

    if (audioBlob) {
      const localUrl = URL.createObjectURL(audioBlob);
      setOralPlaybackUrl(localUrl);
      return () => URL.revokeObjectURL(localUrl);
    }

    const storedPath = (existingResult?.reponses_eleve as any)?.audio_path as string | undefined;
    if (!storedPath) {
      setOralPlaybackUrl(null);
      return;
    }

    let cancelled = false;
    void supabase.storage.from("test-audio").createSignedUrl(storedPath, 60 * 60).then(({ data, error }) => {
      if (!cancelled) setOralPlaybackUrl(error ? null : data?.signedUrl ?? null);
    });
    return () => { cancelled = true; };
  }, [audioBlob, existingResult?.reponses_eleve, isCompetenceEO]);

  useEffect(() => {
    if (!draftKey || result || isDone || draftRestoredRef.current) return;
    draftRestoredRef.current = true;
    void loadExerciseDraft(draftKey).then((draft) => {
      if (!draft) return;
      setAnswers(draft.answers ?? {});
      if (draft.audioBlob) setAudioBlob(draft.audioBlob);
      toast.info("Tes réponses sauvegardées ont été restaurées.");
    });
  }, [draftKey, isDone, result]);

  useEffect(() => {
    if (!draftKey || result || isDone || (!Object.keys(answers).length && !audioBlob)) return;
    const timeout = window.setTimeout(() => {
      void saveExerciseDraft({
        key: draftKey,
        userId: user!.id,
        devoirId: devoirId!,
        answers,
        audioBlob,
        updatedAt: new Date().toISOString(),
      });
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [answers, audioBlob, devoirId, draftKey, isDone, result, user]);

  useEffect(() => {
    localStorage.setItem("learner-text-size", textSize);
  }, [textSize]);

  useEffect(() => {
    localStorage.setItem("learner-high-contrast", String(highContrast));
  }, [highContrast]);

  useEffect(() => {
    setHasListened(false);
    setAudioPlayCount(0);
    setShowTranscript(false);
    randomClickRef.current.reset();
  }, [ex?.id]);

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
      payload: {
        exercice_id: ex.id,
        exercice_titre: ex.titre,
        competence: ex.competence,
        timestamp: new Date().toISOString(),
      },
    });
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
    if (!navigator.onLine && draftKey) {
      await queueSubmission({
        key: draftKey,
        userId: user.id,
        devoirId: devoirId!,
        kind: "oral",
        answers: {},
        audioBlob,
        createdAt: new Date().toISOString(),
      });
      toast.success("Enregistrement sauvegardé", {
        description: "Il sera envoyé automatiquement au retour de la connexion.",
      });
      navigate("/eleve/devoirs");
      return;
    }
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
        setSubmittedOralTranscript(transcription);
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
      if (draftKey) void deleteExerciseDraft(draftKey);
      qc.invalidateQueries({ queryKey: ["eleve-devoirs"] });
      qc.invalidateQueries({ queryKey: ["devoir-detail", devoirId] });
      toast.success(`Devoir oral soumis : ${qualitativeProgress(score).label}`);

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
      if (!navigator.onLine && draftKey) {
        await queueSubmission({
          key: draftKey,
          userId: user.id,
          devoirId: devoirId!,
          kind: "oral",
          answers: {},
          audioBlob,
          createdAt: new Date().toISOString(),
        });
        toast.success("Enregistrement sauvegardé", {
          description: "Il sera envoyé automatiquement au retour de la connexion.",
        });
        navigate("/eleve/devoirs");
      } else {
        toast.error("Erreur de soumission", { description: e.message });
      }
    } finally {
      setSubmitting(false);
    }
  }, [devoir, ex, user, audioBlob, devoirId, contenu, metadata, draftKey, navigate]);

  const maybeEmitRandomClick = useCallback((item: any, idx: number, chosen: string) => {
    const sessionId = (devoir as any)?.session_id as string | null;
    if (!sessionId || !user?.id) return;
    const isCorrect = String(chosen) === String(item.bonne_reponse);
    if (!randomClickRef.current.record(idx, isCorrect)) return;
    void emitLiveEvent({
      sessionId,
      eleveId: user.id,
      eventType: "clic_aleatoire_probable",
      payload: {
        exercice_id: ex?.id,
        item_indices: [idx - 2, idx - 1, idx].filter((n) => n >= 0),
        pattern: "3_reponses_rapides_score_faible",
      },
    });
  }, [devoir, user?.id, ex?.id]);

  const handleSubmit = useCallback(async () => {
    if (!devoir || !ex || !user) return;
    if (eeWordStatus && !eeWordStatus.ok) {
      toast.error("Production trop courte", { description: eeWordStatus.message });
      return;
    }
    if (!navigator.onLine && draftKey) {
      await queueSubmission({
        key: draftKey,
        userId: user.id,
        devoirId: devoirId!,
        kind: "text",
        answers,
        createdAt: new Date().toISOString(),
      });
      toast.success("Réponses sauvegardées", {
        description: "Elles seront envoyées automatiquement au retour de la connexion.",
      });
      navigate("/eleve/devoirs");
      return;
    }
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
            session_id: (devoir as any)?.session_id ?? undefined,
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
      if (draftKey) void deleteExerciseDraft(draftKey);
      qc.invalidateQueries({ queryKey: ["eleve-devoirs"] });
      qc.invalidateQueries({ queryKey: ["devoir-detail", devoirId] });
      toast.success(`Devoir soumis : ${qualitativeProgress(score).label}`);

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
      if (!navigator.onLine && draftKey) {
        await queueSubmission({
          key: draftKey,
          userId: user.id,
          devoirId: devoirId!,
          kind: "text",
          answers,
          createdAt: new Date().toISOString(),
        });
        toast.success("Réponses sauvegardées", {
          description: "Elles seront envoyées automatiquement au retour de la connexion.",
        });
        navigate("/eleve/devoirs");
      } else {
        toast.error("Erreur de soumission", { description: e.message });
      }
    } finally {
      setSubmitting(false);
    }
  }, [devoir, ex, user, items, answers, devoirId, draftKey, navigate, eeWordStatus]);

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
    const adaptiveOutcome = learningPath?.adaptive_policy
      ? resolveLearningPathOutcome(finalResult.score, learningPath.adaptive_policy, learningPath.step_order, learningPath.step_count)
      : null;
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

        {isCompetenceEO && (() => {
          const oralItem = Array.isArray(finalResult.correction) ? finalResult.correction[0] : null;
          const storedAnswers = existingResult?.reponses_eleve as any;
          const transcript = submittedOralTranscript
            ?? storedAnswers?.transcription
            ?? oralItem?.reponse_donnee
            ?? oralItem?.reponse_eleve
            ?? null;
          const correctedText = oralItem?.reformulation_modele
            ?? (oralItem?.bonne_reponse_label === "exemple_attendu" ? oralItem?.bonne_reponse : null);

          return (
            <Card className="border-primary/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Mic className="h-4 w-4 text-primary" />
                  Ma réponse orale et son corrigé
                </CardTitle>
                <CardDescription>Réécoute-toi, compare la transcription puis écoute une formulation correcte.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-semibold">1. Ce que j'ai dit</p>
                  {oralPlaybackUrl ? <audio controls preload="metadata" src={oralPlaybackUrl} className="w-full" /> : <p className="text-sm text-muted-foreground">L'enregistrement audio n'est plus disponible, mais la transcription reste accessible.</p>}
                </div>
                <div className="rounded-md border bg-muted/30 p-3">
                  <p className="mb-1 text-sm font-semibold">2. Transcription automatique</p>
                  <p className="text-sm">{transcript || "Transcription indisponible."}</p>
                  <p className="mt-2 text-xs text-muted-foreground">La reconnaissance vocale peut contenir des erreurs : compare-la avec ce que tu entends.</p>
                </div>
                <div className="rounded-md border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950/30">
                  <p className="mb-2 text-sm font-semibold text-green-800 dark:text-green-300">3. Une formulation correcte</p>
                  <p className="text-sm">{correctedText || "Le corrigé oral détaillé n'est pas disponible pour cette tentative."}</p>
                  {correctedText && <div className="mt-3"><TTSAudioPlayer text={String(correctedText)} label="Écouter la formulation correcte" showSpeedControl /></div>}
                </div>
              </CardContent>
            </Card>
          );
        })()}

        <CorrectionDetaillee
          itemResults={finalResult.correction}
          scoreNormalized={finalResult.score}
          displayMode="qualitative"
        />
        {adaptiveOutcome && (
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Suite adaptée du parcours</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{adaptiveOutcome.learnerMessage}</p>
              <Badge className="mt-3" variant="secondary">
                {adaptiveOutcome.decision === "remediation"
                  ? "Reprise guidée"
                  : adaptiveOutcome.decision === "extension"
                    ? "Extension"
                    : "Consolidation"}
              </Badge>
            </CardContent>
          </Card>
        )}

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
    <div className={cn(
      "space-y-6 max-w-2xl mx-auto",
      learnerTextSizeClass(textSize),
      highContrast && "learner-high-contrast"
    )}>
      <InterventionPlayer sessionId={(devoir as any)?.session_id ?? null} />
      <LearnerAccessibilityToolbar
        textSize={textSize}
        highContrast={highContrast}
        onTextSizeChange={setTextSize}
        onHighContrastChange={setHighContrast}
      />
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/eleve/devoirs")} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{ex?.titre}</h1>
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">{ex?.competence} · {ex?.format?.replace(/_/g, " ")}</p>
            {(ex?.metadata_code || metadata?.code) && (
              <Badge variant="outline" className="text-xs">{ex?.metadata_code || metadata.code}</Badge>
            )}
          </div>
        </div>
      </div>

      {user?.id && <SmartTextHint />}

      {learningPath?.step_count && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold">Parcours progressif</span>
              <Badge variant="secondary">
                Étape {learningPath.step_order ?? 1}/{learningPath.step_count}
              </Badge>
            </div>
            <Progress
              value={((learningPath.step_order ?? 1) / learningPath.step_count) * 100}
              className="mt-2 h-2"
            />
          </CardContent>
        </Card>
      )}

      {lesson && (
        <Card className="border-blue-300 bg-blue-50/70 dark:border-blue-900 dark:bg-blue-950/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-5 w-5" />
              {lesson.title || "Leçon"}
            </CardTitle>
            {lesson.objective && <CardDescription>{lesson.objective}</CardDescription>}
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed">
            {lesson.explanation && <p>{lesson.explanation}</p>}
            {Array.isArray(lesson.key_points) && lesson.key_points.length > 0 && (
              <div>
                <p className="mb-1 font-semibold">À retenir</p>
                <ul className="list-disc space-y-1 pl-5">
                  {lesson.key_points.map((point, index) => <li key={index}>{point}</li>)}
                </ul>
              </div>
            )}
            {Array.isArray(lesson.examples) && lesson.examples.length > 0 && (
              <div>
                <p className="mb-1 font-semibold">Exemples</p>
                <ul className="space-y-1 rounded-lg bg-background/70 p-3">
                  {lesson.examples.map((example, index) => <li key={index}>{example}</li>)}
                </ul>
              </div>
            )}
            {lesson.estimated_minutes && (
              <p className="text-xs text-muted-foreground">Temps conseillé : {lesson.estimated_minutes} min</p>
            )}
          </CardContent>
        </Card>
      )}

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
          <TranslatedInstruction text={ex?.consigne || ""} />
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
              playCount={audioPlayCount}
              maxPlays={maxAudioPlays}
              showSpeedControl
              onPlayStart={() => setAudioPlayCount((count) => count + 1)}
              onPlayComplete={() => setHasListened(true)}
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-medium" aria-live="polite">
                {maxAudioPlays
                  ? `${audioPlayCount}/${maxAudioPlays} écoute${maxAudioPlays > 1 ? "s" : ""}`
                  : `${audioPlayCount} écoute${audioPlayCount > 1 ? "s" : ""}`}
                {remainingPlays === 0 ? " · Limite atteinte" : ""}
              </span>
              {!transcriptLocked && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTranscript((visible) => !visible)}
                  aria-expanded={showTranscript}
                >
                  {showTranscript ? "Masquer le texte" : "Afficher le texte"}
                </Button>
              )}
            </div>
            {showTranscript && !transcriptLocked && (
              <div className="mt-3 border-l-4 border-primary bg-background p-3 leading-relaxed">
                {user?.id ? (
                  <SmartText text={scriptAudio} studentId={user.id} contextSentence={scriptAudio} />
                ) : (
                  scriptAudio
                )}
              </div>
            )}
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
                    {item.options.map((opt: string, oi: number) => {
                      const selectOption = () => {
                        setAnswers((prev) => ({ ...prev, [idx]: opt }));
                        maybeEmitRandomClick(item, idx, opt);
                      };
                      return (
                        <div
                          key={oi}
                          role="button"
                          tabIndex={0}
                          aria-pressed={answers[idx] === opt}
                          className={cn(
                            "btn-reponse-eleve cursor-pointer",
                            answers[idx] === opt && "selected"
                          )}
                          onClick={selectOption}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              selectOption();
                            }
                          }}
                        >
                          <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm">
                            {String.fromCharCode(65 + oi)}
                          </span>
                          {user?.id ? (
                            <SmartText
                              text={opt}
                              studentId={user.id}
                              contextSentence={item.question}
                              className="flex-1"
                            />
                          ) : (
                            <span className="flex-1">{opt}</span>
                          )}
                          <TTSAudioPlayer text={opt} size="icon" />
                        </div>
                      );
                    })}
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

          {isCompetenceEE && eeWordStatus && (
            <p
              className={cn(
                "text-sm text-center",
                eeWordStatus.ok ? "text-muted-foreground" : "text-destructive font-medium",
              )}
              aria-live="polite"
            >
              {eeWordStatus.message}
            </p>
          )}

          <Button
            onClick={handleSubmit}
            disabled={submitting || coLocked || (eeWordStatus != null && !eeWordStatus.ok)}
            className="w-full gap-2"
            size="xxl"
          >
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
