import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { updateProfilEleve } from "@/lib/updateProfilEleve";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";


import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  ArrowLeft, CheckCircle2, XCircle, Loader2, Send, ChevronRight, ChevronLeft,
  ClipboardCheck, BookOpen, AlertCircle, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ExternalResourceViewer, type ExternalResource } from "@/components/ExternalResourceViewer";
import { ExternalResourceReturnForm } from "@/components/ExternalResourceReturnForm";
import CompetenceLabel from "@/components/CompetenceLabel";
import TTSAudioPlayer from "@/components/ui/TTSAudioPlayer";
import SessionFeedbackForm from "@/components/SessionFeedbackForm";
import { logEvent } from "@/lib/analytics";
import ReportProblemButton from "@/components/ReportProblemButton";
import RegenerateItemButton from "@/components/RegenerateItemButton";
import { useLiveAttemptSync } from "@/hooks/useLiveAttemptSync";

const STORAGE_KEY_PREFIX = "bilan-seance-progress-";

const SUPPORT_KEYS = ["texte", "paragraphe", "document", "contexte", "texte_support", "script_audio"] as const;
const IMAGE_KEYS = ["image", "image_url", "visual", "support_visuel", "illustration", "media_url"] as const;

const getImageUrl = (source?: Record<string, unknown> | null): string => {
  if (!source) return "";
  for (const key of IMAGE_KEYS) {
    const value = getStringValue(source[key]);
    if (value && (value.startsWith("http://") || value.startsWith("https://"))) return value;
  }
  return "";
};

const getStringValue = (value: unknown) => {
  if (typeof value !== "string") return "";
  return value.trim();
};

const extractQuotedBlock = (text: string, open: string, close: string = open) => {
  const start = text.indexOf(open);
  const end = text.lastIndexOf(close);

  if (start === -1 || end === -1 || end <= start) return "";

  return getStringValue(text.slice(start + open.length, end));
};

const extractSupportFromConsigne = (consigne?: string) => {
  const normalized = getStringValue(consigne);
  if (!normalized) return "";

  const quotedText =
    extractQuotedBlock(normalized, "«", "»") ||
    extractQuotedBlock(normalized, '"') ||
    extractQuotedBlock(normalized, "'");

  if (quotedText.length >= 12) return quotedText;

  const colonIndex = normalized.indexOf(":");
  if (colonIndex === -1) return "";

  const trailingText = getStringValue(normalized.slice(colonIndex + 1));
  return trailingText.length >= 24 && /[.!?]/.test(trailingText) ? trailingText : "";
};

const getSupportText = (source?: Record<string, unknown> | null) => {
  if (!source) return "";

  for (const key of SUPPORT_KEYS) {
    const value = getStringValue(source[key]);
    if (value) return value;
  }

  return "";
};

const getExerciseSupportText = (exercise: any) => {
  const contenu = exercise?.contenu as Record<string, unknown> | undefined;
  return getSupportText(contenu) || extractSupportFromConsigne(exercise?.consigne);
};

const SafeImageBlock = ({ url }: { url: string }) => {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
      <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide font-semibold">🖼️ Document visuel</p>
      <img
        src={url}
        alt="Support visuel de l'exercice"
        className="max-w-full rounded-lg mx-auto"
        onError={() => setFailed(true)}
      />
    </div>
  );
};

const BilanSeance = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const storageKey = `${STORAGE_KEY_PREFIX}${sessionId}-${user?.id}`;

  // Restore saved progress from localStorage
  const savedProgress = (() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return JSON.parse(raw) as { currentExIdx: number; answers: Record<string, Record<number, string>> };
    } catch { /* ignore */ }
    return null;
  })();

  const [currentExIdx, setCurrentExIdx] = useState(savedProgress?.currentExIdx ?? 0);
  const [answers, setAnswers] = useState<Record<string, Record<number, string>>>(savedProgress?.answers ?? {});
  const [submitting, setSubmitting] = useState(false);
  const [reportedExIds, setReportedExIds] = useState<Set<string>>(new Set());
  const [reportedItemKeys, setReportedItemKeys] = useState<Set<string>>(new Set());
  const [itemOverrides, setItemOverrides] = useState<Record<string, any>>({});
  const [externalIdx, setExternalIdx] = useState(0);
  const [externalAutoScore, setExternalAutoScore] = useState<number | undefined>(undefined);
  const [externalShowForm, setExternalShowForm] = useState(false);
  const [results, setResults] = useState<{
    scores: { exerciceId: string; titre: string; competence: string; score: number; correction: any[] }[];
    globalScore: number;
    devoirsCreated: number;
  } | null>(null);

  // Fetch session info
  const { data: session } = useQuery({
    queryKey: ["bilan-session-info", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("*, group:groups(nom)")
        .eq("id", sessionId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!sessionId,
  });

  // Fetch exercises marked as traite_en_classe for this session
  const { data: exercices, isLoading } = useQuery({
    queryKey: ["bilan-exercices", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("session_exercices")
        .select("*, exercice:exercices(id, titre, consigne, competence, format, contenu, niveau_vise, formateur_id)")
        .eq("session_id", sessionId!)
        .eq("statut", "traite_en_classe" as any)
        .order("ordre");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!sessionId,
  });

  // Check if bilan already done (any result for this session's exercises)
  const { data: existingResults } = useQuery({
    queryKey: ["bilan-existing", sessionId, user?.id],
    queryFn: async () => {
      if (!exercices || exercices.length === 0) return [];
      const exerciceIds = exercices.map((se: any) => se.exercice?.id).filter(Boolean);
      const { data, error } = await supabase
        .from("resultats")
        .select("exercice_id, score, correction_detaillee")
        .eq("eleve_id", user!.id)
        .in("exercice_id", exerciceIds);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!exercices && exercices.length > 0 && !!user?.id,
  });

  // External resources for this session
  const { data: externalResources } = useQuery({
    queryKey: ["bilan-external-resources", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("external_resources")
        .select("*")
        .eq("session_id", sessionId!)
        .order("ordre");
      if (error) throw error;
      return (data ?? []) as ExternalResource[];
    },
    enabled: !!sessionId,
  });

  const { data: existingExternalResults } = useQuery({
    queryKey: ["bilan-existing-external", sessionId, user?.id],
    queryFn: async () => {
      const ids = (externalResources ?? []).map((r) => r.id);
      if (!ids.length) return [];
      const { data, error } = await supabase
        .from("external_resource_results")
        .select("external_resource_id")
        .eq("student_id", user!.id)
        .in("external_resource_id", ids);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!externalResources?.length && !!user?.id,
  });

  const validExercices = (exercices ?? []).filter((se: any) => {
    const contenu = se.exercice?.contenu as any;
    return contenu?.items && Array.isArray(contenu.items) && contenu.items.length > 0;
  });

  // Filter out exercises already answered
  const alreadyDoneIds = new Set((existingResults ?? []).map((r) => r.exercice_id));
  const pendingExercices = validExercices.filter((se: any) => !alreadyDoneIds.has(se.exercice?.id));

  const doneExternalIds = new Set(
    (existingExternalResults ?? []).map((r) => r.external_resource_id)
  );
  const pendingExternal = (externalResources ?? []).filter((r) => !doneExternalIds.has(r.id));

  const currentSe = pendingExercices[currentExIdx];
  const currentEx = currentSe?.exercice as any;
  const rawCurrentItems: any[] = currentEx?.contenu?.items ?? [];
  const currentItems: any[] = rawCurrentItems.map((it, idx) => {
    const key = `${currentEx?.id}:${idx}`;
    return itemOverrides[key] ? { ...it, ...itemOverrides[key] } : it;
  });
  const exerciseSupportText = getExerciseSupportText(currentEx);
  const currentAnswers = answers[currentEx?.id] ?? {};

  // ─── LIVE SYNC: upsert exercise_attempts sur l'exercice courant ───
  // Permet au formateur de voir l'avancement en direct (Realtime).
  // La finalisation "completed" est gérée par le trigger mirror_resultat_to_attempt
  // lors de l'insertion dans `resultats` (handleSubmit ci-dessous).
  useLiveAttemptSync({
    exerciseId: currentEx?.id ?? null,
    learnerId: user?.id ?? null,
    answers: currentAnswers,
    items: currentItems,
    disabled: !!results,
    sourceApp: "primo-bilan-live",
  });
  const totalQuestions = pendingExercices.reduce((acc: number, se: any) => {
    const items = se.exercice?.contenu?.items ?? [];
    return acc + items.length;
  }, 0);
  const answeredQuestions = Object.values(answers).reduce(
    (acc, exAnswers) => acc + Object.keys(exAnswers).length,
    0
  );
  // Auto-save progress to localStorage whenever answers or index change
  useEffect(() => {
    if (!storageKey || !sessionId || !user?.id) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ currentExIdx, answers }));
    } catch { /* quota exceeded, ignore */ }
  }, [currentExIdx, answers, storageKey, sessionId, user?.id]);

  const handleSubmit = async () => {
    if (!user || pendingExercices.length === 0) return;
    setSubmitting(true);
    try {
      const scores: typeof results extends null ? never : NonNullable<typeof results>["scores"] = [];
      let totalScore = 0;
      let devoirsCreated = 0;

      let countedExercices = 0;
      for (const se of pendingExercices) {
        const ex = se.exercice as any;
        if (reportedExIds.has(ex.id)) continue; // exercice signalé : exclu du score
        const rawItems: any[] = ex?.contenu?.items ?? [];
        const items: any[] = rawItems.map((it, idx) => {
          const key = `${ex.id}:${idx}`;
          return itemOverrides[key] ? { ...it, ...itemOverrides[key] } : it;
        });
        const exAnswers = answers[ex.id] ?? {};

        let correct = 0;
        let countedItems = 0;
        const correction = items.map((item: any, idx: number) => {
          const itemKey = `${ex.id}:${idx}`;
          const itemReported = reportedItemKeys.has(itemKey);
          const userAnswer = exAnswers[idx] || "";
          const isCorrect = userAnswer.trim().toLowerCase() === (item.bonne_reponse || "").trim().toLowerCase();
          if (!itemReported) {
            if (isCorrect) correct++;
            countedItems++;
          }
          return {
            question: item.question || item.texte || item.enonce || `Question ${idx + 1}`,
            reponse_eleve: userAnswer,
            bonne_reponse: item.bonne_reponse,
            correct: isCorrect,
            explication: item.explication || "",
            reported: itemReported,
          };
        });

        const score = countedItems > 0 ? Math.round((correct / countedItems) * 100) : 0;
        totalScore += score;
        countedExercices++;

        // Insert result
        const { error: resErr } = await supabase.from("resultats").insert({
          eleve_id: user.id,
          exercice_id: ex.id,
          score,
          reponses_eleve: exAnswers as any,
          correction_detaillee: correction as any,
          tentative: 1,
        });
        if (resErr) console.error("Result insert error:", resErr);

        scores.push({
          exerciceId: ex.id,
          titre: ex.titre,
          competence: ex.competence,
          score,
          correction,
        });

        // Auto-create devoir if score < 80% and formateur_id available
        if (score < 80 && ex.formateur_id) {
          // Check existing active devoirs count
          const { count } = await supabase
            .from("devoirs")
            .select("id", { count: "exact", head: true })
            .eq("eleve_id", user.id)
            .eq("statut", "en_attente" as any);

          if ((count ?? 0) < 3) {
            const raison = score < 60 ? "remediation" : "consolidation";
            const { error: devErr } = await supabase.from("devoirs").insert({
              eleve_id: user.id,
              exercice_id: ex.id,
              formateur_id: ex.formateur_id,
              session_id: sessionId!,
              raison: raison as any,
              statut: "en_attente" as any,
            });
            if (!devErr) devoirsCreated++;
          }
        }

        // Update student competency status
        const statut = score >= 80 ? "acquis_provisoire" : score >= 60 ? "consolide" : "non_acquis";
        await supabase
          .from("student_competency_status")
          .upsert(
            {
              eleve_id: user.id,
              competence: ex.competence,
              statut: statut as any,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "eleve_id,competence" }
          );
      }

      const globalScore = countedExercices > 0
        ? Math.round(totalScore / countedExercices)
        : 0;

      // Propagate scores to profils_eleves for monitoring visibility
      try {
        await updateProfilEleve(user.id, session?.niveau_cible || undefined);
      } catch (profileErr) {
        console.error("Profile update failed:", profileErr);
      }

      logEvent({
        actorId: user.id,
        actorType: 'eleve',
        verb: 'completed',
        objectId: sessionId,
        objectType: 'session',
        context: 'seance',
        sessionId: sessionId,
        result: { globalScore, exercicesCount: pendingExercices.length },
      });

      // Clear saved progress after successful submission
      try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
      setResults({ scores, globalScore, devoirsCreated });
      qc.invalidateQueries({ queryKey: ["eleve-devoirs"] });
      qc.invalidateQueries({ queryKey: ["eleve-bilans"] });
      qc.invalidateQueries({ queryKey: ["bilan-existing"] });
      qc.invalidateQueries({ queryKey: ["profil-eleve"] });
      qc.invalidateQueries({ queryKey: ["eleve-resultats"] });
      toast.success(`Exercices soumis ! Score moyen : ${globalScore}%`);
    } catch (e: any) {
      toast.error("Erreur lors de la soumission", { description: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  // External-resources only flow (no pending exercises but external resources to do)
  if (pendingExercices.length === 0 && pendingExternal.length > 0 && !results) {
    const currentExternal = pendingExternal[Math.min(externalIdx, pendingExternal.length - 1)];
    const handleExternalDone = (autoScore?: number) => {
      setExternalAutoScore(autoScore);
      setExternalShowForm(true);
    };
    const handleExternalSubmitted = () => {
      setExternalShowForm(false);
      setExternalAutoScore(undefined);
      qc.invalidateQueries({ queryKey: ["bilan-existing-external", sessionId, user?.id] });
      if (externalIdx < pendingExternal.length - 1) {
        setExternalIdx((i) => i + 1);
      } else {
        toast.success("Toutes les ressources externes sont validées !");
        navigate("/eleve");
      }
    };
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/eleve")} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Retour
          </Button>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <ExternalLink className="h-5 w-5 text-primary" />
              Ressources externes
            </h1>
            <p className="text-sm text-muted-foreground">
              {externalIdx + 1} / {pendingExternal.length}
            </p>
          </div>
        </div>

        <Progress value={((externalIdx) / Math.max(pendingExternal.length, 1)) * 100} className="h-2" />

        {!externalShowForm ? (
          <ExternalResourceViewer resource={currentExternal} onCompleted={handleExternalDone} />
        ) : (
          <ExternalResourceReturnForm
            resourceId={currentExternal.id}
            sessionId={sessionId!}
            provider={currentExternal.provider}
            initialScore={externalAutoScore}
            initialSource={externalAutoScore !== undefined ? "auto_captured" : "declared"}
            onSubmitted={handleExternalSubmitted}
          />
        )}
      </div>
    );
  }

  // All done already (exercices + external)
  if (pendingExercices.length === 0 && pendingExternal.length === 0 && !results) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12 space-y-4">
        <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
        <h2 className="text-xl font-bold">Séance déjà complétée</h2>
        <p className="text-muted-foreground">Tu as déjà fait tous les exercices et ressources de cette séance.</p>
        <Button variant="outline" onClick={() => navigate("/eleve")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Retour au dashboard
        </Button>
      </div>
    );
  }

  // Show results
  if (results) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/eleve")} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Button>
          <h1 className="text-xl font-bold">Résultats des exercices</h1>
        </div>

        <Card className={cn(
          "text-center",
          results.globalScore >= 80 ? "border-green-500/30" : results.globalScore >= 60 ? "border-orange-500/30" : "border-destructive/30"
        )}>
          <CardContent className="pt-6 pb-4">
            <p className={cn(
              "text-5xl font-black",
              results.globalScore >= 80 ? "text-green-600" : results.globalScore >= 60 ? "text-orange-600" : "text-destructive"
            )}>
              {results.globalScore}%
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {`Score moyen sur ${results.scores.length} ${results.scores.length === 1 ? "exercice" : "exercices"}`}
            </p>
            {results.devoirsCreated > 0 && (
              <Badge variant="secondary" className="mt-3 gap-1">
                <BookOpen className="h-3 w-3" />
                {`${results.devoirsCreated} ${results.devoirsCreated === 1 ? "devoir de révision créé" : "devoirs de révision créés"} automatiquement`}
              </Badge>
            )}
          </CardContent>
        </Card>

        {/* Per-exercise results */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Détail par exercice
          </h2>
          {results.scores.map((s) => (
            <Card key={s.exerciceId} className={cn(
              "border-l-4",
              s.score >= 80 ? "border-l-green-500" : s.score >= 60 ? "border-l-orange-500" : "border-l-destructive"
            )}>
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm">{s.titre}</p>
                    <Badge variant="outline" className="text-xs mt-1">
                      <CompetenceLabel code={s.competence} />
                    </Badge>
                  </div>
                  <span className={cn(
                    "text-2xl font-bold",
                    s.score >= 80 ? "text-green-600" : s.score >= 60 ? "text-orange-600" : "text-destructive"
                  )}>
                    {s.score}%
                  </span>
                </div>

                {/* Correction */}
                <div className="mt-3 space-y-2">
                  {s.correction.map((c: any, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      {c.correct ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                      )}
                      <div>
                        <p className="text-muted-foreground">{c.question}</p>
                        {!c.correct && (
                          <p className="text-xs text-green-600 mt-0.5">Réponse correcte : {c.bonne_reponse}</p>
                        )}
                        {c.explication && (
                          <p className="text-xs text-muted-foreground/70 mt-0.5 italic">{c.explication}</p>
                        )}
                        {c.reformulation_modele && (
                          <div className="mt-1.5 p-2 rounded-md bg-blue-50 border border-blue-200 dark:bg-blue-950/30 dark:border-blue-800 text-xs">
                            <p className="text-blue-800 dark:text-blue-300">
                              💡 <strong>Ce que tu aurais pu dire :</strong> « {c.reformulation_modele} »
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {sessionId && user?.id && (
          <SessionFeedbackForm sessionId={sessionId} eleveId={user.id} />
        )}

        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={() => navigate("/eleve")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Dashboard
          </Button>
          <Button onClick={() => navigate("/eleve/devoirs")}>
            Mes devoirs <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  }

  // ── Exercise passation ──
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/eleve")} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Button>
        <div>
          <h1 className="text-xl font-bold">
            Exercices de séance{session ? ` — ${(session as any).titre}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground">
            {(session as any)?.group?.nom} · {`${pendingExercices.length} ${pendingExercices.length === 1 ? "exercice à faire" : "exercices à faire"}`}
          </p>
        </div>
      </div>

      {/* Global progress */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Exercice {currentExIdx + 1} / {pendingExercices.length}</span>
          <span>{answeredQuestions} / {totalQuestions} questions répondues</span>
        </div>
        <Progress value={(answeredQuestions / Math.max(totalQuestions, 1)) * 100} className="h-2" />
      </div>

      {/* Current exercise */}
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-primary" />
                {currentEx?.titre}
              </CardTitle>
              <CardDescription className="mt-1 text-xl leading-relaxed">{currentEx?.consigne}</CardDescription>
              {currentEx?.consigne && currentEx?.competence !== "CO" && (
                <TTSAudioPlayer
                  text={currentEx.consigne}
                  size="sm"
                  label="🔊 Écouter la consigne"
                  className="mt-1"
                />
              )}
            </div>
            <Badge variant="outline">
              <CompetenceLabel code={currentEx?.competence} />
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* TTS for CO exercises */}
          {currentEx?.competence === "CO" && (currentEx?.contenu as any)?.script_audio && (
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-xs text-primary mb-2 uppercase tracking-wide font-semibold">🔊 Écoute audio</p>
              <TTSAudioPlayer text={(currentEx.contenu as any).script_audio} />
            </div>
          )}
          {/* Image support — JAMAIS pour CO (l'audio doit suffire) */}
          {currentEx?.competence !== "CO" && (() => {
            const imageUrl = getImageUrl(currentEx?.contenu as Record<string, unknown> | undefined);
            if (!imageUrl) return null;
            return (
              <SafeImageBlock url={imageUrl} />
            );
          })()}
          {exerciseSupportText && currentEx?.competence !== "CO" && (
            <div className="p-4 rounded-lg bg-muted/50 text-sm whitespace-pre-line border border-border/50 leading-relaxed">
              <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide font-semibold">📄 Document à lire</p>
              {exerciseSupportText}
            </div>
          )}
          {/* Avertissement si CE/EE sans aucun support : éviter de demander à l'élève de répondre dans le vide */}
          {currentEx?.competence !== "CO" &&
           !exerciseSupportText &&
           !getImageUrl(currentEx?.contenu as Record<string, unknown> | undefined) &&
           (currentEx?.competence === "CE" || currentEx?.competence === "EE") && (
            <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-900 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-200">
              <p className="font-semibold mb-1">⚠️ Support manquant</p>
              <p>Cet exercice n'a pas de document à lire. Réponds aux questions du mieux possible et signale le problème à ton formateur.</p>
            </div>
          )}
          {currentItems.map((item: any, idx: number) => {
            // Skip malformed items with no question text
            if (!item.question && !item.texte && !item.enonce) return null;
            const questionText = item.question || item.texte || item.enonce || `Question ${idx + 1}`;
            const itemSupportText = getSupportText(item);
            const shouldShowItemSupport = itemSupportText && itemSupportText !== exerciseSupportText;
            return (
            <div key={idx} className="space-y-2">
              {/* Item-level support text if different from exercise-level */}
              {shouldShowItemSupport && (
                <div className="p-3 rounded-lg bg-muted/50 text-sm whitespace-pre-line border border-border/50 mb-2">
                  {itemSupportText}
                </div>
              )}
              <p className="font-medium text-sm">
                <span className="text-primary font-bold mr-2">Q{idx + 1}.</span>
                {questionText}
              </p>
              {Array.isArray(item.options) && item.options.length > 0 ? (
                <div className="space-y-2">
                  {item.options.map((opt: string, oi: number) => (
                    <button
                      key={oi}
                      className={cn(
                        "btn-reponse-eleve",
                        currentAnswers[idx] === opt && "selected"
                      )}
                      onClick={() =>
                        setAnswers((prev) => ({
                          ...prev,
                          [currentEx.id]: { ...(prev[currentEx.id] ?? {}), [idx]: opt },
                        }))
                      }
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
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                  placeholder="Ta réponse..."
                  value={currentAnswers[idx] || ""}
                  onChange={(e) =>
                    setAnswers((prev) => ({
                      ...prev,
                      [currentEx.id]: { ...(prev[currentEx.id] ?? {}), [idx]: e.target.value },
                    }))
                  }
                />
              )}
              {/* Per-item regenerate */}
              <div className="flex justify-end pt-1">
                {reportedItemKeys.has(`${currentEx.id}:${idx}`) ? (
                  <Badge variant="outline" className="text-xs text-destructive border-destructive/40">
                    ⚠️ Question neutralisée
                  </Badge>
                ) : (
                  <RegenerateItemButton
                    competence={currentEx.competence}
                    format={currentEx.format}
                    niveau={currentEx.niveau_vise || (session as any)?.niveau_cible || "A1"}
                    consigne={currentEx.consigne}
                    currentItem={{
                      question: item.question,
                      options: item.options,
                      bonne_reponse: item.bonne_reponse,
                      explication: item.explication,
                    }}
                    currentSupport={{
                      texte_support: exerciseSupportText,
                      script_audio: (currentEx.contenu as any)?.script_audio,
                    }}
                    onRegenerated={(newItem) => {
                      const key = `${currentEx.id}:${idx}`;
                      setItemOverrides((prev) => ({ ...prev, [key]: newItem }));
                      setAnswers((prev) => {
                        const exA = { ...(prev[currentEx.id] ?? {}) };
                        delete exA[idx];
                        return { ...prev, [currentEx.id]: exA };
                      });
                    }}
                    onFallback={() => {
                      const key = `${currentEx.id}:${idx}`;
                      setReportedItemKeys((prev) => new Set(prev).add(key));
                    }}
                    reportContext={{
                      context: "bilan_seance",
                      exerciceId: currentEx.id,
                      formateurId: currentEx.formateur_id,
                      itemIndex: idx,
                    }}
                  />
                )}
              </div>
            </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Signalement de l'exercice courant */}
      {currentEx && (
        <div className="flex justify-center">
          {reportedExIds.has(currentEx.id) ? (
            <Badge variant="outline" className="text-destructive border-destructive/40">
              ⚠️ Exercice signalé — non compté dans le bilan
            </Badge>
          ) : (
            <ReportProblemButton
              context="bilan_seance"
              exerciceId={currentEx.id}
              formateurId={currentEx.formateur_id}
              onReported={() => {
                setReportedExIds((prev) => new Set(prev).add(currentEx.id));
                if (currentExIdx < pendingExercices.length - 1) {
                  setCurrentExIdx((i) => i + 1);
                }
              }}
            />
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          disabled={currentExIdx === 0}
          onClick={() => setCurrentExIdx((i) => i - 1)}
          className="gap-1"
        >
          <ChevronLeft className="h-4 w-4" /> Précédent
        </Button>
        <div className="flex-1" />
        {currentExIdx < pendingExercices.length - 1 ? (
          <Button onClick={() => setCurrentExIdx((i) => i + 1)} className="gap-1">
            Suivant <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="gap-2"
            variant="default"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Soumettre mes réponses
          </Button>
        )}
      </div>
    </div>
  );
};

export default BilanSeance;
