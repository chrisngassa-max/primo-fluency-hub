import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
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
  palierScores: number[];
  paliersFinal: { co: number; ce: number; eo: number; ee: number };
  scores: { co: number; ce: number; eo: number; ee: number };
}

const TestPositionnement = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [screen, setScreen] = useState<Screen>("accueil");
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [writtenAnswer, setWrittenAnswer] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [aiEvaluation, setAiEvaluation] = useState<{
    score: number;
    justification: string;
  } | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Check existing session
  const { data: existingSession, isLoading } = useQuery({
    queryKey: ["test-positionnement-session", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("test_sessions")
        .select("*")
        .eq("apprenant_id", user.id)
        .order("date_debut", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
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

    // If there's an in-progress session, resume
    if (existingSession && existingSession.statut === "en_cours") {
      const state: SessionState = {
        sessionId: existingSession.id,
        competenceIndex: 0,
        palier: existingSession.palier_co ?? 1,
        questionIndex: 0,
        palierScores: [],
        paliersFinal: { co: 1, ce: 1, eo: 1, ee: 1 },
        scores: {
          co: existingSession.score_co ?? 0,
          ce: existingSession.score_ce ?? 0,
          eo: existingSession.score_eo ?? 0,
          ee: existingSession.score_ee ?? 0,
        },
      };
      setSessionState(state);
      const qs = await loadQuestions("CO", state.palier);
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

  const currentCompetence = sessionState
    ? COMPETENCE_ORDER[sessionState.competenceIndex]
    : "CO";
  const currentQuestion = questions[sessionState?.questionIndex ?? 0];

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      toast({
        title: "Microphone",
        description: "Impossible d'accéder au microphone.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const handleValidateQCM = async () => {
    if (!sessionState || !currentQuestion || !selectedAnswer) return;
    setIsSubmitting(true);

    const estCorrect =
      selectedAnswer === currentQuestion.reponse_correcte;
    const scoreObtenu = estCorrect ? 1 : 0;

    await supabase.from("test_reponses").insert({
      session_id: sessionState.sessionId,
      question_id: currentQuestion.id,
      competence: currentCompetence,
      palier: sessionState.palier,
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
    const path = `${sessionState.sessionId}/${currentQuestion.id}.webm`;
    const { error: uploadError } = await supabase.storage
      .from("test-audio")
      .upload(path, audioBlob, { contentType: "audio/webm" });

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

      if (sttError || !sttData?.transcript) {
        toast({
          title: "Serveur vocal indisponible",
          description: "Veuillez réessayer.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
      transcription = sttData.transcript;
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

    await supabase.from("test_reponses").insert({
      session_id: sessionState.sessionId,
      question_id: currentQuestion.id,
      competence: currentCompetence,
      palier: sessionState.palier,
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
    setIsSubmitting(false);
  };

  const handleValidateEcrit = async () => {
    if (!sessionState || !currentQuestion || !writtenAnswer.trim()) return;
    setIsSubmitting(true);

    const evaluation = await evaluerReponseIA(
      { criteres_evaluation: currentQuestion.criteres_evaluation },
      writtenAnswer
    );

    await supabase.from("test_reponses").insert({
      session_id: sessionState.sessionId,
      question_id: currentQuestion.id,
      competence: currentCompetence,
      palier: sessionState.palier,
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
                <TTSAudioPlayer text={currentQuestion.script_audio} />
              </div>
            )}

            {/* Support for CE */}
            {currentQuestion.support && (
              <Card className="bg-muted/30">
                <CardContent className="pt-4">
                  {currentQuestion.support.startsWith("http") ? (
                    <img src={currentQuestion.support} alt="Document de support" className="max-w-full rounded-lg mx-auto" />
                  ) : (
                    <p className="text-base whitespace-pre-wrap">
                      {currentQuestion.support}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Consigne */}
            <p className="text-lg font-medium">{currentQuestion.consigne}</p>

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
                <div className="flex gap-3">
                  {!isRecording ? (
                    <Button
                      onClick={startRecording}
                      variant="outline"
                      size="lg"
                      className="flex-1 gap-2"
                    >
                      <Mic className="h-5 w-5" />
                      Enregistrer
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
                  <audio
                    controls
                    src={URL.createObjectURL(audioBlob)}
                    className="w-full"
                  />
                )}
                <Button
                  className="w-full"
                  size="lg"
                  disabled={!audioBlob || isSubmitting}
                  onClick={handleValidateOral}
                >
                  {isSubmitting ? "Évaluation en cours…" : "Valider"}
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
    );
  }

  // SCREEN: ACCUEIL
  return (
    <div className="max-w-2xl mx-auto space-y-6 p-4">
      <h1 className="text-2xl font-bold text-foreground">
        Test de positionnement
      </h1>
      <Card>
        <CardContent className="pt-6 space-y-4">
          <p className="text-base text-muted-foreground">
            Ce test permet de connaître votre niveau de français. Il dure environ
            20 minutes.
          </p>
          <p className="text-sm text-muted-foreground">
            Vous passerez 4 épreuves : Compréhension orale, Compréhension
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
