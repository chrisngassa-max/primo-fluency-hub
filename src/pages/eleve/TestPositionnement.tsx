import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import {
  getMicrophoneErrorMessage,
  requestMicrophoneStream,
  startWavRecording,
} from "@/lib/audioRecorder";
import {
  getPalierSuivant,
  calculerProfilFinal,
  suggererGroupe,
  evaluerReponseIA,
  getProfilLabel,
  getProfilMessage,
  COMPETENCE_ORDER,
} from "@/lib/testPositionnement";
import { Mic, Square } from "lucide-react";
import TTSAudioPlayer from "@/components/ui/TTSAudioPlayer";

type Screen = "accueil" | "question" | "resultats";

interface TestQuestion {
  id: string;
  competence: string;
  palier: number;
  numero_dans_palier: number;
  consigne: string;
  support: string | null;
  script_audio: string | null;
  type_reponse: string;
  choix_a: string | null;
  choix_b: string | null;
  choix_c: string | null;
  reponse_correcte: string | null;
  criteres_evaluation: unknown;
  points_max: number;
}

interface SessionState {
  sessionId: string;
  competenceIndex: number;
  palier: number;
  questionIndex: number;
  currentResponseId: string | null;
  palierScores: number[];
  paliersFinal: { co: number; ce: number; eo: number; ee: number };
  scores: { co: number; ce: number; eo: number; ee: number };
}

const TestPositionnement = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [screen, setScreen] = useState<Screen>("accueil");
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const autoStartRef = useRef(false);
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [writtenAnswer, setWrittenAnswer] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordingCount, setRecordingCount] = useState(0);
  const MAX_RECORDINGS = 2;
  const [aiEvaluation, setAiEvaluation] = useState<{
    score: number;
    justification: string;
  } | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Prevent accidental exit during test
  const isTestInProgress = screen === "question";

  useEffect(() => {
    if (!isTestInProgress) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isTestInProgress]);

  const getPreferredSession = useCallback(async () => {
    if (!user?.id) return null;

    const { data: sessions, error } = await supabase
      .from("test_sessions")
      .select("*")
      .eq("apprenant_id", user.id)
      .order("date_debut", { ascending: false });

    if (error || !sessions?.length) return null;

    const sessionIds = sessions.map((session) => session.id);
    const { data: responses } = await supabase
      .from("test_reponses")
      .select("session_id, date_reponse, score_obtenu")
      .in("session_id", sessionIds)
      .order("date_reponse", { ascending: false });

    const activityBySession = new Map<
      string,
      {
        answeredCount: number;
        draftCount: number;
        latestResponseAt: string | null;
      }
    >();

    sessions.forEach((session) => {
      activityBySession.set(session.id, {
        answeredCount: 0,
        draftCount: 0,
        latestResponseAt: null,
      });
    });

    (responses ?? []).forEach((response) => {
      const entry = activityBySession.get(response.session_id);
      if (!entry) return;

      if (response.score_obtenu === null) {
        entry.draftCount += 1;
      } else {
        entry.answeredCount += 1;
      }

      if (
        response.date_reponse &&
        (!entry.latestResponseAt ||
          new Date(response.date_reponse).getTime() >
            new Date(entry.latestResponseAt).getTime())
      ) {
        entry.latestResponseAt = response.date_reponse;
      }
    });

    return [...sessions].sort((a, b) => {
      const aStats = activityBySession.get(a.id);
      const bStats = activityBySession.get(b.id);
      const aInProgress = a.statut === "en_cours" ? 1 : 0;
      const bInProgress = b.statut === "en_cours" ? 1 : 0;

      if (aInProgress !== bInProgress) return bInProgress - aInProgress;

      const aHasProgress =
        (aStats?.answeredCount ?? 0) + (aStats?.draftCount ?? 0) > 0 ? 1 : 0;
      const bHasProgress =
        (bStats?.answeredCount ?? 0) + (bStats?.draftCount ?? 0) > 0 ? 1 : 0;

      if (aHasProgress !== bHasProgress) return bHasProgress - aHasProgress;

      if ((aStats?.answeredCount ?? 0) !== (bStats?.answeredCount ?? 0)) {
        return (bStats?.answeredCount ?? 0) - (aStats?.answeredCount ?? 0);
      }

      const aActivity = new Date(
        aStats?.latestResponseAt ?? a.date_debut ?? 0
      ).getTime();
      const bActivity = new Date(
        bStats?.latestResponseAt ?? b.date_debut ?? 0
      ).getTime();

      if (aActivity !== bActivity) return bActivity - aActivity;

      return new Date(b.date_debut ?? 0).getTime() - new Date(a.date_debut ?? 0).getTime();
    })[0] ?? null;
  }, [user?.id]);

  // Check existing session
  const { data: existingSession, isLoading } = useQuery({
    queryKey: ["test-positionnement-session", user?.id],
    queryFn: getPreferredSession,
    enabled: !!user?.id,
  });

  // Check for completed results
  const { data: existingResults } = useQuery({
    queryKey: ["test-positionnement-results", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("test_resultats_apprenants")
        .select("*")
        .eq("apprenant_id", user.id)
        .order("date_test", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (existingResults) {
      setScreen("resultats");
      setSessionState({
        sessionId: existingResults.session_id,
        competenceIndex: 4,
        palier: 1,
        questionIndex: 0,
        currentResponseId: null,
        palierScores: [],
        paliersFinal: {
          co: existingResults.palier_final_co ?? 1,
          ce: existingResults.palier_final_ce ?? 1,
          eo: existingResults.palier_final_eo ?? 1,
          ee: existingResults.palier_final_ee ?? 1,
        },
        scores: {
          co: existingResults.score_co ?? 0,
          ce: existingResults.score_ce ?? 0,
          eo: existingResults.score_eo ?? 0,
          ee: existingResults.score_ee ?? 0,
        },
      });
    }
  }, [existingResults]);


  const loadQuestions = useCallback(
    async (competence: string, palier: number) => {
      const { data, error } = await supabase
        .from("test_questions")
        .select("*")
        .eq("competence", competence)
        .eq("palier", palier)
        .order("numero_dans_palier", { ascending: true });
      if (error) {
        console.error("Error loading questions:", error);
        return [];
      }
      return (data as TestQuestion[]) ?? [];
    },
    []
  );

  const handleStart = async () => {
    if (!user?.id) return;

    const resumableSession = await getPreferredSession();

    // If there's an in-progress session, resume at exact position
    if (resumableSession && resumableSession.statut === "en_cours") {
      // Fetch all existing responses to determine exact position
      const { data: existingResponses } = await supabase
        .from("test_reponses")
        .select("id, question_id, competence, palier, score_obtenu, date_reponse")
        .eq("session_id", resumableSession.id)
        .order("date_reponse", { ascending: true });

      const answeredScores = new Map<string, number>();
      const draftIds = new Map<string, string>();

      (existingResponses ?? []).forEach((response) => {
        if (response.score_obtenu === null) {
          if (!draftIds.has(response.question_id)) {
            draftIds.set(response.question_id, response.id);
          }
          return;
        }

        answeredScores.set(response.question_id, response.score_obtenu);
        draftIds.delete(response.question_id);
      });

      // Determine which competence/palier the student was on from the session
      const sessionPaliers = {
        co: resumableSession.palier_co ?? 1,
        ce: resumableSession.palier_ce ?? 1,
        eo: resumableSession.palier_eo ?? 1,
        ee: resumableSession.palier_ee ?? 1,
      };

      for (let ci = 0; ci < COMPETENCE_ORDER.length; ci++) {
        const comp = COMPETENCE_ORDER[ci];
        const compKey = comp.toLowerCase() as "co" | "ce" | "eo" | "ee";
        const palier = sessionPaliers[compKey];

        // Load questions for this competence/palier
        const qs = await loadQuestions(comp, palier);

        let resumeQuestionIndex = -1;
        let resumeResponseId: string | null = null;

        for (let qi = 0; qi < qs.length; qi++) {
          const questionId = qs[qi].id;

          if (draftIds.has(questionId)) {
            resumeQuestionIndex = qi;
            resumeResponseId = draftIds.get(questionId) ?? null;
            break;
          }

          if (!answeredScores.has(questionId)) {
            resumeQuestionIndex = qi;
            break;
          }
        }

        if (resumeQuestionIndex !== -1) {
          // Found where to resume
          const restoredPaliersFinal = { co: 1, ce: 1, eo: 1, ee: 1 };
          for (let completedIndex = 0; completedIndex < ci; completedIndex++) {
            const completedComp = COMPETENCE_ORDER[completedIndex];
            const completedKey = completedComp.toLowerCase() as "co" | "ce" | "eo" | "ee";
            restoredPaliersFinal[completedKey] = sessionPaliers[completedKey];
          }

          const palierScores = qs
            .slice(0, resumeQuestionIndex)
            .map((question) => answeredScores.get(question.id))
            .filter((score): score is number => typeof score === "number");

          const state: SessionState = {
            sessionId: resumableSession.id,
            competenceIndex: ci,
            palier,
            questionIndex: resumeQuestionIndex,
            currentResponseId: resumeResponseId,
            palierScores,
            paliersFinal: restoredPaliersFinal,
            scores: {
              co: resumableSession.score_co ?? 0,
              ce: resumableSession.score_ce ?? 0,
              eo: resumableSession.score_eo ?? 0,
              ee: resumableSession.score_ee ?? 0,
            },
          };
          setSessionState(state);
          setQuestions(qs);
          setScreen("question");
          return;
        }
      }

      // If we get here, all questions are answered — the test might be effectively done
      // but the session wasn't marked as complete. Start from the last competence.
      const lastComp = COMPETENCE_ORDER[COMPETENCE_ORDER.length - 1];
      const lastKey = lastComp.toLowerCase() as "co" | "ce" | "eo" | "ee";
      const qs = await loadQuestions(lastComp, sessionPaliers[lastKey]);
      const state: SessionState = {
        sessionId: resumableSession.id,
        competenceIndex: COMPETENCE_ORDER.length - 1,
        palier: sessionPaliers[lastKey],
        questionIndex: 0,
        currentResponseId: null,
        palierScores: [],
        paliersFinal: { co: 1, ce: 1, eo: 1, ee: 1 },
        scores: {
          co: resumableSession.score_co ?? 0,
          ce: resumableSession.score_ce ?? 0,
          eo: resumableSession.score_eo ?? 0,
          ee: resumableSession.score_ee ?? 0,
        },
      };
      setSessionState(state);
      setQuestions(qs);
      if (qs.length > 0) setScreen("question");
      return;
    }

    const { data, error } = await supabase
      .from("test_sessions")
      .insert({ apprenant_id: user.id })
      .select()
      .single();

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de démarrer le test.",
        variant: "destructive",
      });
      return;
    }

    const state: SessionState = {
      sessionId: data.id,
      competenceIndex: 0,
      palier: 1,
      questionIndex: 0,
      currentResponseId: null,
      palierScores: [],
      paliersFinal: { co: 1, ce: 1, eo: 1, ee: 1 },
      scores: { co: 0, ce: 0, eo: 0, ee: 0 },
    };
    setSessionState(state);
    const qs = await loadQuestions("CO", 1);
    setQuestions(qs);
    if (qs.length > 0) {
      setScreen("question");
    } else {
      toast({
        title: "Aucune question disponible",
        description:
          "Les questions du test n'ont pas encore été ajoutées.",
        variant: "destructive",
      });
    }
  };

  // Auto-start: skip accueil screen and go directly to questions
  useEffect(() => {
    if (autoStartRef.current || isLoading) return;
    if (existingResults) return;
    if (screen !== "accueil") return;
    autoStartRef.current = true;
    handleStart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, existingResults, existingSession]);

  const currentCompetence = sessionState
    ? COMPETENCE_ORDER[sessionState.competenceIndex]
    : "CO";
  const currentQuestion = questions[sessionState?.questionIndex ?? 0];

  useEffect(() => {
    if (!sessionState || !currentQuestion || screen !== "question") return;

    let cancelled = false;

    const ensureDraftExists = async () => {
      const { data: existingRows } = await supabase
        .from("test_reponses")
        .select("id, score_obtenu")
        .eq("session_id", sessionState.sessionId)
        .eq("question_id", currentQuestion.id)
        .order("date_reponse", { ascending: false });

      if (cancelled) return;

      const answeredRow = (existingRows ?? []).find(
        (row) => row.score_obtenu !== null
      );
      if (answeredRow) return;

      const draftRow = (existingRows ?? []).find(
        (row) => row.score_obtenu === null
      );

      if (draftRow?.id) {
        setSessionState((prev) => {
          if (
            !prev ||
            prev.sessionId !== sessionState.sessionId ||
            prev.questionIndex !== sessionState.questionIndex ||
            prev.currentResponseId === draftRow.id
          ) {
            return prev;
          }

          return { ...prev, currentResponseId: draftRow.id };
        });
        return;
      }

      const draftPayload: TablesInsert<"test_reponses"> = {
        session_id: sessionState.sessionId,
        question_id: currentQuestion.id,
        competence: currentCompetence,
        palier: sessionState.palier,
      };

      const { data: insertedDraft } = await supabase
        .from("test_reponses")
        .insert(draftPayload)
        .select("id")
        .single();

      if (cancelled || !insertedDraft?.id) return;

      setSessionState((prev) => {
        if (
          !prev ||
          prev.sessionId !== sessionState.sessionId ||
          prev.questionIndex !== sessionState.questionIndex
        ) {
          return prev;
        }

        return { ...prev, currentResponseId: insertedDraft.id };
      });
    };

    void ensureDraftExists();

    return () => {
      cancelled = true;
    };
  }, [
    currentCompetence,
    currentQuestion,
    screen,
    sessionState?.competenceIndex,
    sessionState?.palier,
    sessionState?.questionIndex,
    sessionState?.sessionId,
  ]);

  const wavRecorderRef = useRef<{ stop: () => void } | null>(null);

  const persistCurrentResponse = useCallback(
    async (payload: TablesUpdate<"test_reponses">) => {
      if (!sessionState || !currentQuestion) {
        return { error: new Error("missing-session") };
      }

      const basePayload: TablesInsert<"test_reponses"> = {
        session_id: sessionState.sessionId,
        question_id: currentQuestion.id,
        competence: currentCompetence,
        palier: sessionState.palier,
        ...payload,
      };

      let responseId = sessionState.currentResponseId;

      if (!responseId) {
        const { data: existingRows } = await supabase
          .from("test_reponses")
          .select("id, score_obtenu")
          .eq("session_id", sessionState.sessionId)
          .eq("question_id", currentQuestion.id)
          .order("date_reponse", { ascending: false });

        responseId =
          (existingRows ?? []).find((row) => row.score_obtenu === null)?.id ?? null;
      }

      if (responseId) {
        const { error } = await supabase
          .from("test_reponses")
          .update(basePayload)
          .eq("id", responseId);

        if (!error) {
          setSessionState((prev) =>
            prev ? { ...prev, currentResponseId: responseId } : prev
          );
        }

        return { error };
      }

      const { data, error } = await supabase
        .from("test_reponses")
        .insert(basePayload)
        .select("id")
        .single();

      if (!error && data?.id) {
        setSessionState((prev) =>
          prev ? { ...prev, currentResponseId: data.id } : prev
        );
      }

      return { error };
    },
    [currentCompetence, currentQuestion, sessionState]
  );

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

      toast({
        title: "Microphone",
        description: getMicrophoneErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    wavRecorderRef.current?.stop();
    wavRecorderRef.current = null;
    setIsRecording(false);
    setRecordingCount((c) => c + 1);
  };

  const handleValidateQCM = async () => {
    if (!sessionState || !currentQuestion || !selectedAnswer) return;
    setIsSubmitting(true);

    const estCorrect =
      selectedAnswer === currentQuestion.reponse_correcte;
    const scoreObtenu = estCorrect ? 1 : 0;

    await persistCurrentResponse({
      reponse_apprenant: selectedAnswer,
      est_correct: estCorrect,
      score_obtenu: scoreObtenu,
    });

    toast({
      title: estCorrect ? "Bonne réponse !" : "Réponse enregistrée",
    });

    await advanceToNext(scoreObtenu);
    setSelectedAnswer("");
    setIsSubmitting(false);
  };

  const handleValidateOral = async () => {
    if (!sessionState || !currentQuestion || !audioBlob) return;
    setIsSubmitting(true);

    // Upload audio to storage (kept for formateur playback)
    const path = `${sessionState.sessionId}/${currentQuestion.id}.wav`;
    const { error: uploadError } = await supabase.storage
      .from("test-audio")
      .upload(path, audioBlob, { contentType: "audio/wav" });

    if (uploadError) {
      console.error("Upload error:", uploadError);
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("test-audio").getPublicUrl(path);

    // Convert audioBlob to base64 for STT
    let transcription = "(Transcription échouée - Audio illisible)";
    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          // Strip the data:audio/webm;base64, prefix
          const base64 = dataUrl.split(",")[1] || "";
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });

      const { data: sttData, error: sttError } = await supabase.functions.invoke(
        "transcribe-audio",
        { body: { audioBase64: base64Data } }
      );

      console.log("STT response:", { sttData, sttError });

      if (sttError) {
        console.error("STT invocation error:", sttError);
        toast({
          title: "Serveur vocal indisponible",
          description: "Veuillez réessayer.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      // Empty transcript is OK — it means no speech was detected
      transcription = sttData?.transcript || "(Aucune parole détectée)";
    } catch (sttErr) {
      console.error("STT error:", sttErr);
      toast({
        title: "Serveur vocal indisponible",
        description: "Veuillez réessayer.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    // AI evaluation with real transcription
    let evaluation = aiEvaluation;
    if (!evaluation) {
      evaluation = await evaluerReponseIA(
        { criteres_evaluation: currentQuestion.criteres_evaluation },
        transcription
      );
      setAiEvaluation(evaluation);
    }

    await persistCurrentResponse({
      reponse_audio_url: publicUrl,
      reponse_apprenant: transcription,
      score_ia: evaluation.score,
      justification_ia: evaluation.justification,
      score_obtenu: evaluation.score,
    });

    toast({ title: "Réponse orale enregistrée" });
    await advanceToNext(evaluation.score);
    setAudioBlob(null);
    setAiEvaluation(null);
    setRecordingCount(0);
    setIsSubmitting(false);
  };

  const handleValidateEcrit = async () => {
    if (!sessionState || !currentQuestion || !writtenAnswer.trim()) return;
    setIsSubmitting(true);

    const evaluation = await evaluerReponseIA(
      { criteres_evaluation: currentQuestion.criteres_evaluation },
      writtenAnswer
    );

    await persistCurrentResponse({
      reponse_apprenant: writtenAnswer,
      score_ia: evaluation.score,
      justification_ia: evaluation.justification,
      score_obtenu: evaluation.score,
    });

    toast({ title: "Réponse écrite enregistrée" });
    await advanceToNext(evaluation.score);
    setWrittenAnswer("");
    setIsSubmitting(false);
  };

  const advanceToNext = async (scoreObtenu: number) => {
    if (!sessionState) return;

    const newPalierScores = [...sessionState.palierScores, scoreObtenu];
    const newQuestionIndex = sessionState.questionIndex + 1;

    // Still questions in this palier
    if (newQuestionIndex < questions.length) {
      setSessionState({
        ...sessionState,
        questionIndex: newQuestionIndex,
        currentResponseId: null,
        palierScores: newPalierScores,
      });
      return;
    }

    // Palier finished — compute score
    const scorePalier = newPalierScores.reduce((a, b) => a + b, 0);
    const compKey = currentCompetence.toLowerCase() as "co" | "ce" | "eo" | "ee";
    const newScores = {
      ...sessionState.scores,
      [compKey]: sessionState.scores[compKey] + scorePalier,
    };

    const nextPalier = getPalierSuivant(scorePalier, sessionState.palier);

    if (nextPalier) {
      // Advance palier in same competence
      const palierField = `palier_${compKey}`;
      await supabase
        .from("test_sessions")
        .update({
          [palierField]: nextPalier,
          [`score_${compKey}`]: newScores[compKey],
        })
        .eq("id", sessionState.sessionId);

      const qs = await loadQuestions(currentCompetence, nextPalier);
      setQuestions(qs);
      setSessionState({
        ...sessionState,
        palier: nextPalier,
        questionIndex: 0,
        currentResponseId: null,
        palierScores: [],
        scores: newScores,
        paliersFinal: {
          ...sessionState.paliersFinal,
          [compKey]: nextPalier,
        },
      });
      return;
    }

    // Competence finished — record final palier
    const newPaliersFinal = {
      ...sessionState.paliersFinal,
      [compKey]: sessionState.palier,
    };

    await supabase
      .from("test_sessions")
      .update({ [`score_${compKey}`]: newScores[compKey] })
      .eq("id", sessionState.sessionId);

    const nextCompIndex = sessionState.competenceIndex + 1;

    if (nextCompIndex < COMPETENCE_ORDER.length) {
      // Move to next competence
      const nextComp = COMPETENCE_ORDER[nextCompIndex];
      const qs = await loadQuestions(nextComp, 1);
      setQuestions(qs);
      setSessionState({
        ...sessionState,
        competenceIndex: nextCompIndex,
        palier: 1,
        questionIndex: 0,
        currentResponseId: null,
        palierScores: [],
        paliersFinal: newPaliersFinal,
        scores: newScores,
      });
    } else {
      // Test finished
      const profil = calculerProfilFinal(newPaliersFinal);
      const groupe = suggererGroupe(profil);

      await supabase
        .from("test_sessions")
        .update({
          statut: "termine",
          date_fin: new Date().toISOString(),
          profil_final: profil,
          groupe_suggere: groupe,
        })
        .eq("id", sessionState.sessionId);

      await supabase.from("test_resultats_apprenants").insert({
        apprenant_id: user!.id,
        session_id: sessionState.sessionId,
        score_total:
          newScores.co + newScores.ce + newScores.eo + newScores.ee,
        score_co: newScores.co,
        score_ce: newScores.ce,
        score_eo: newScores.eo,
        score_ee: newScores.ee,
        palier_final_co: newPaliersFinal.co,
        palier_final_ce: newPaliersFinal.ce,
        palier_final_eo: newPaliersFinal.eo,
        palier_final_ee: newPaliersFinal.ee,
        profil,
        groupe_suggere: groupe,
      });

      setSessionState({
        ...sessionState,
        competenceIndex: 4,
        currentResponseId: null,
        paliersFinal: newPaliersFinal,
        scores: newScores,
      });
      setScreen("resultats");
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 p-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  // SCREEN: RESULTATS
  if (screen === "resultats" && sessionState) {
    const profil =
      existingResults?.profil ??
      calculerProfilFinal(sessionState.paliersFinal);
    const maxScore = 12; // 4 paliers × 3 points max per competence
    return (
      <div className="max-w-2xl mx-auto space-y-6 p-4">
        <h1 className="text-2xl font-bold text-foreground">
          Votre test est terminé. Merci !
        </h1>

        <Card>
          <CardHeader>
            <CardTitle>Scores par compétence</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(["co", "ce", "eo", "ee"] as const).map((comp) => {
              const label = comp.toUpperCase();
              const score = sessionState.scores[comp];
              const pct = Math.round((score / maxScore) * 100);
              return (
                <div key={comp} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{label}</span>
                    <span className="text-muted-foreground">
                      {score}/{maxScore}
                    </span>
                  </div>
                  <Progress value={pct} className="h-3" />
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="text-center space-y-3">
          <Badge className="text-lg px-4 py-2">{getProfilLabel(profil)}</Badge>
          <p className="text-base text-muted-foreground">
            {getProfilMessage(profil)}
          </p>
        </div>

        <Button
          className="w-full"
          size="lg"
          onClick={() => navigate("/eleve")}
        >
          Retour à l'accueil
        </Button>
      </div>
    );
  }

  // SCREEN: QUESTION
  if (screen === "question" && sessionState && currentQuestion) {
    const totalQInPalier = questions.length;
    const progressPct =
      ((sessionState.questionIndex + 1) / totalQInPalier) * 100;

    return (
      <>
        <div className="max-w-2xl mx-auto space-y-4 p-4">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-sm">
              {currentCompetence} — Palier {sessionState.palier}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Question {sessionState.questionIndex + 1}/{totalQInPalier}
            </span>
          </div>
          <Progress value={progressPct} className="h-2" />
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            {/* TTS audio player for CO */}
            {currentQuestion.script_audio && (
              <div className="rounded-lg border bg-primary/5 border-primary/20 p-4">
                <p className="text-xs text-primary mb-2 uppercase tracking-wide font-semibold">🔊 Écoute audio</p>
                <TTSAudioPlayer key={currentQuestion.id} text={currentQuestion.script_audio} />
              </div>
            )}

            {/* Support for CE */}
            {currentQuestion.support && (
              <Card className="bg-muted/30">
                <CardContent className="pt-4">
                  {currentQuestion.support.startsWith("http") ? (
                    <img src={currentQuestion.support} alt="Document de support" className="max-w-full rounded-lg mx-auto" />
                  ) : currentQuestion.support.length <= 30 ? (
                    /* Short text = sign/panel rendering */
                    <div className="flex justify-center">
                      <div className="bg-primary text-primary-foreground rounded-lg px-8 py-6 text-center shadow-md border-4 border-primary/70 min-w-[120px]">
                        <span className="text-2xl sm:text-3xl font-bold tracking-wide">
                          {currentQuestion.support}
                        </span>
                      </div>
                    </div>
                  ) : (
                    /* Longer text = document/notice rendering */
                    <div className="bg-background border-2 border-border rounded-lg p-4 shadow-sm">
                      <p className="text-base whitespace-pre-wrap leading-relaxed">
                        {currentQuestion.support}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Consigne + TTS */}
            <div className="space-y-2">
              <p className="text-lg font-medium">{currentQuestion.consigne}</p>
              {!currentQuestion.script_audio && (
                <TTSAudioPlayer key={`consigne-${currentQuestion.id}`} text={currentQuestion.consigne} />
              )}
            </div>

            {/* QCM */}
            {currentQuestion.type_reponse === "qcm" && (
              <div className="space-y-4">
                <RadioGroup
                  value={selectedAnswer}
                  onValueChange={setSelectedAnswer}
                  className="space-y-3"
                >
                  {["A", "B", "C"].map((letter) => {
                    const key = `choix_${letter.toLowerCase()}` as
                      | "choix_a"
                      | "choix_b"
                      | "choix_c";
                    const text = currentQuestion[key];
                    if (!text) return null;
                    return (
                      <div
                        key={letter}
                        className="flex items-center space-x-3 rounded-lg border p-4 cursor-pointer hover:bg-accent/50"
                      >
                        <RadioGroupItem value={letter} id={`opt-${letter}`} />
                        <Label
                          htmlFor={`opt-${letter}`}
                          className="text-base cursor-pointer flex-1"
                        >
                          {text}
                        </Label>
                      </div>
                    );
                  })}
                </RadioGroup>
                <Button
                  className="w-full"
                  size="lg"
                  disabled={!selectedAnswer || isSubmitting}
                  onClick={handleValidateQCM}
                >
                  {isSubmitting ? "Validation…" : "Valider"}
                </Button>
              </div>
            )}

            {/* Oral */}
            {currentQuestion.type_reponse === "oral" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Vous pouvez vous enregistrer {MAX_RECORDINGS} fois avant de valider.
                  {recordingCount > 0 && !isRecording && (
                    <span className="font-medium">
                      {" "}— Enregistrement {recordingCount}/{MAX_RECORDINGS} utilisé{recordingCount > 1 ? "s" : ""}
                    </span>
                  )}
                </p>
                <div className="flex gap-3">
                  {!isRecording ? (
                    <Button
                      onClick={() => {
                        setAudioBlob(null);
                        startRecording();
                      }}
                      variant="outline"
                      size="lg"
                      className="flex-1 gap-2"
                      disabled={recordingCount >= MAX_RECORDINGS && audioBlob !== null}
                    >
                      <Mic className="h-5 w-5" />
                      {recordingCount === 0 ? "Enregistrer" : "Réenregistrer"}
                    </Button>
                  ) : (
                    <Button
                      onClick={stopRecording}
                      variant="destructive"
                      size="lg"
                      className="flex-1 gap-2"
                    >
                      <Square className="h-5 w-5" />
                      Arrêter
                    </Button>
                  )}
                </div>
                {audioBlob && (
                  <>
                    <audio
                      controls
                      src={URL.createObjectURL(audioBlob)}
                      className="w-full"
                    />
                    {recordingCount < MAX_RECORDINGS && (
                      <p className="text-xs text-muted-foreground text-center">
                        Pas satisfait ? Cliquez sur « Réenregistrer » ({MAX_RECORDINGS - recordingCount} essai{MAX_RECORDINGS - recordingCount > 1 ? "s" : ""} restant{MAX_RECORDINGS - recordingCount > 1 ? "s" : ""})
                      </p>
                    )}
                  </>
                )}
                <Button
                  className="w-full"
                  size="lg"
                  disabled={!audioBlob || isSubmitting}
                  onClick={handleValidateOral}
                >
                  {isSubmitting ? "Évaluation en cours…" : "Valider ma réponse"}
                </Button>
              </div>
            )}

            {/* Ecrit */}
            {currentQuestion.type_reponse === "ecrit" && (
              <div className="space-y-4">
                <Textarea
                  value={writtenAnswer}
                  onChange={(e) => setWrittenAnswer(e.target.value)}
                  placeholder="Tapez votre réponse ici…"
                  className="min-h-[120px] text-base"
                />
                <Button
                  className="w-full"
                  size="lg"
                  disabled={!writtenAnswer.trim() || isSubmitting}
                  onClick={handleValidateEcrit}
                >
                  {isSubmitting ? "Évaluation en cours…" : "Valider"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      </>
    );
  }

  // SCREEN: ACCUEIL (fallback — normally auto-started)
  return (
    <div className="max-w-2xl mx-auto space-y-6 p-4">
      <h1 className="text-2xl font-bold text-foreground">
        Test de positionnement
      </h1>
      <Card>
        <CardContent className="pt-6 space-y-4">
          <p className="text-base text-muted-foreground">
            Ce test adaptatif permet de connaître ton niveau de français. Il dure environ
            20 minutes et couvre 4 compétences.
          </p>
          <p className="text-sm text-muted-foreground">
            Tu passeras 4 épreuves : Compréhension orale, Compréhension
            écrite, Expression orale et Expression écrite.
          </p>
          <Button
            className="w-full"
            size="lg"
            onClick={handleStart}
            disabled={existingSession?.statut === "termine"}
          >
            {existingSession?.statut === "en_cours"
              ? "Reprendre le test"
              : existingSession?.statut === "termine"
              ? "Test déjà terminé"
              : "Commencer le test"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default TestPositionnement;
