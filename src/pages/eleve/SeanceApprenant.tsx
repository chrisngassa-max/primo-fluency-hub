import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Layers3, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchLearnerSessionBlocks,
  fetchOwnExerciseAttempt,
  fetchSessionActivities,
  markCorrectionViewed,
  submitExerciseAttempt,
  type LearnerActivity,
  type LearnerExerciseBlock,
  type LearnerSessionBlock,
} from "@/lib/curriculum/learnerSession";
import { corrigerExercice, type CorrigerResult } from "@/lib/correctionExercice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";

/**
 * Parcours apprenant intégré d'une séance (S01 en pilote). Remplace la page
 * séparée S01InteractiveExercises comme point d'entrée apprenant : ici,
 * supports + exercices + corrections vivent dans un seul déroulé organisé en
 * Activité X sur N -> Exercice Y sur M -> Question Z sur K. Aucun PDF n'est
 * chargé ni exposé (les vues *_learner_view ne portent jamais file_url).
 */
export default function SeanceApprenant() {
  const { sessionCode = "" } = useParams<{ sessionCode: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [activityIndex, setActivityIndex] = useState(0);
  const [blockIndex, setBlockIndex] = useState(0);
  const [itemIndex, setItemIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [lockedItems, setLockedItems] = useState<Set<number>>(new Set());
  const [justSubmittedResult, setJustSubmittedResult] = useState<CorrigerResult | null>(null);

  const { data: activities = [], isLoading: loadingActivities } = useQuery({
    queryKey: ["seance-apprenant-activities", sessionCode],
    queryFn: () => fetchSessionActivities(sessionCode),
    enabled: !!sessionCode,
  });

  const { data: blocks = [], isLoading: loadingBlocks } = useQuery({
    queryKey: ["seance-apprenant-blocks", sessionCode],
    queryFn: () => fetchLearnerSessionBlocks(sessionCode),
    enabled: !!sessionCode,
  });

  const activityGroups = useMemo(() => {
    const byActivity = new Map<string | null, LearnerSessionBlock[]>();
    for (const block of blocks) {
      const key = block.activity_id;
      if (!byActivity.has(key)) byActivity.set(key, []);
      byActivity.get(key)!.push(block);
    }
    // N'affiche que les activités qui ont réellement du contenu visible.
    return activities.filter((activity) => (byActivity.get(activity.id) ?? []).length > 0)
      .map((activity) => ({ activity, blocks: byActivity.get(activity.id) ?? [] }));
  }, [activities, blocks]);

  const currentGroup = activityGroups[activityIndex];
  const currentBlock = currentGroup?.blocks[blockIndex];

  const currentExercise = currentBlock?.kind === "exercise" ? (currentBlock as LearnerExerciseBlock) : null;

  const { data: attempt, isLoading: loadingAttempt } = useQuery({
    queryKey: ["seance-apprenant-attempt", currentExercise?.exercice_id, user?.id],
    queryFn: () => fetchOwnExerciseAttempt(currentExercise!.exercice_id, user!.id),
    enabled: !!currentExercise && !!user?.id,
  });

  function resetExerciseNav() {
    setItemIndex(0);
    setAnswers({});
    setLockedItems(new Set());
    setJustSubmittedResult(null);
  }

  function goToBlock(nextActivityIndex: number, nextBlockIndex: number) {
    setActivityIndex(nextActivityIndex);
    setBlockIndex(nextBlockIndex);
    resetExerciseNav();
  }

  function goNextBlock() {
    if (!currentGroup) return;
    if (blockIndex + 1 < currentGroup.blocks.length) {
      goToBlock(activityIndex, blockIndex + 1);
    } else if (activityIndex + 1 < activityGroups.length) {
      goToBlock(activityIndex + 1, 0);
    }
  }

  function goPrevBlock() {
    if (blockIndex > 0) {
      goToBlock(activityIndex, blockIndex - 1);
    } else if (activityIndex > 0) {
      const prevGroup = activityGroups[activityIndex - 1];
      goToBlock(activityIndex - 1, Math.max(0, prevGroup.blocks.length - 1));
    }
  }

  const isFirstBlock = activityIndex === 0 && blockIndex === 0;
  const isLastBlock = activityIndex === activityGroups.length - 1
    && currentGroup ? blockIndex === currentGroup.blocks.length - 1 : false;

  async function handleValidateItem(item: Record<string, unknown>) {
    setLockedItems((prev) => new Set(prev).add(itemIndex));
    if (!currentExercise) return;
    const items = currentExercise.contenu.items;
    if (itemIndex + 1 < items.length) {
      setItemIndex((i) => i + 1);
      return;
    }
    // Dernier item validé : on corrige et on soumet, mais on n'affiche
    // JAMAIS la correction ici — seule la libération formateur la révèle.
    const result = await corrigerExercice({
      format: currentExercise.format,
      competence: currentExercise.competence,
      items,
      answers,
      metadata: { code: currentExercise.exercice_id },
    });
    setJustSubmittedResult(result);
    if (user?.id) {
      await submitExerciseAttempt({
        exerciseId: currentExercise.exercice_id,
        learnerId: user.id,
        answers: Object.fromEntries(Object.entries(answers).map(([k, v]) => [k, v])),
        itemResults: result.correction,
        scoreNormalized: result.score,
      });
      queryClient.invalidateQueries({ queryKey: ["seance-apprenant-attempt", currentExercise.exercice_id, user.id] });
    }
  }

  const correctionReleased = !!attempt?.correction_released_at;
  const attemptCompleted = !!attempt || !!justSubmittedResult;

  async function handleViewCorrection() {
    if (attempt?.id && !attempt.correction_viewed_at) {
      await markCorrectionViewed(attempt.id);
      queryClient.invalidateQueries({ queryKey: ["seance-apprenant-attempt", currentExercise?.exercice_id, user?.id] });
    }
  }

  if (loadingActivities || loadingBlocks) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (activityGroups.length === 0) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" /> Retour
        </Button>
        <Card><CardContent className="p-6 text-sm text-muted-foreground">
          Cette séance n'a pas encore de contenu publié pour vous. Reviens plus tard ou demande à ton formateur.
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="sm" className="mt-1 gap-1" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" /> Retour
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <Layers3 className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-extrabold text-[#0b234a]">Séance {sessionCode}</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Activité {activityIndex + 1} sur {activityGroups.length} — {currentGroup.activity.title}
          </p>
        </div>
      </div>

      <Progress value={((activityIndex + (blockIndex + 1) / currentGroup.blocks.length) / activityGroups.length) * 100} />

      <div className="flex flex-wrap gap-1.5">
        {activityGroups.map((group, index) => (
          <Badge key={group.activity.id} variant={index === activityIndex ? "default" : "outline"} className={index === activityIndex ? "bg-blue-600" : ""}>
            {index + 1}. {group.activity.title}
          </Badge>
        ))}
      </div>

      {currentBlock?.kind === "support" && (
        <Card>
          <CardContent className="prose prose-sm max-w-none p-5 dark:prose-invert">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-blue-600">
              <BookOpen className="h-4 w-4" /> {currentBlock.title}
            </div>
            <div dangerouslySetInnerHTML={{ __html: currentBlock.content_html || "<p>Support en préparation.</p>" }} />
          </CardContent>
        </Card>
      )}

      {currentExercise && (
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                  Exercice {blockIndex + 1} sur {currentGroup.blocks.length}
                  {!attemptCompleted && ` — Question ${Math.min(itemIndex + 1, currentExercise.contenu.items.length)} sur ${currentExercise.contenu.items.length}`}
                </p>
                <p className="font-semibold">{currentExercise.titre}</p>
              </div>
              <div className="flex gap-1.5">
                <Badge variant="outline">{currentExercise.niveau_vise}</Badge>
                <Badge variant="outline">{currentExercise.competence}</Badge>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{currentExercise.consigne}</p>

            {loadingAttempt ? (
              <Skeleton className="h-24" />
            ) : attemptCompleted ? (
              <CorrectionGate
                released={correctionReleased}
                result={justSubmittedResult}
                storedItemResults={attempt?.item_results as CorrigerResult["correction"] | undefined}
                onViewCorrection={handleViewCorrection}
                viewed={!!attempt?.correction_viewed_at}
              />
            ) : (
              <ExerciseItemForm
                item={currentExercise.contenu.items[itemIndex]}
                index={itemIndex}
                total={currentExercise.contenu.items.length}
                locked={lockedItems.has(itemIndex)}
                value={answers[itemIndex] ?? ""}
                onChange={(value) => setAnswers((prev) => ({ ...prev, [itemIndex]: value }))}
                onValidate={() => handleValidateItem(currentExercise.contenu.items[itemIndex])}
              />
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between">
        <Button variant="outline" disabled={isFirstBlock} onClick={goPrevBlock} className="gap-1">
          <ArrowLeft className="h-4 w-4" /> Précédent
        </Button>
        <Button
          disabled={isLastBlock || (currentExercise ? !attemptCompleted : false)}
          onClick={goNextBlock}
          className="gap-1 bg-blue-600 hover:bg-blue-700"
        >
          Suivant <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function ExerciseItemForm({
  item, index, total, locked, value, onChange, onValidate,
}: {
  item: Record<string, unknown>;
  index: number;
  total: number;
  locked: boolean;
  value: string;
  onChange: (value: string) => void;
  onValidate: () => void;
}) {
  const question = (item.question ?? item.texte ?? item.enonce ?? `Question ${index + 1}`) as string;
  const options = Array.isArray(item.options) ? (item.options as string[]) : null;

  return (
    <div className="space-y-3">
      <p className="font-medium">{question}</p>
      {options ? (
        <RadioGroup value={value} onValueChange={onChange} disabled={locked}>
          {options.map((option) => (
            <div key={option} className="flex items-center gap-2">
              <RadioGroupItem value={option} id={`${index}-${option}`} />
              <Label htmlFor={`${index}-${option}`}>{option}</Label>
            </div>
          ))}
        </RadioGroup>
      ) : (
        <Textarea value={value} onChange={(e) => onChange(e.target.value)} disabled={locked} placeholder="Ta réponse..." />
      )}
      {!locked && (
        <Button onClick={onValidate} disabled={!value.trim()} className="gap-2 bg-blue-600 hover:bg-blue-700">
          <CheckCircle2 className="h-4 w-4" /> Valider ma réponse
        </Button>
      )}
      {locked && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" /> Réponse enregistrée — {index + 1}/{total}
        </p>
      )}
    </div>
  );
}

function CorrectionGate({
  released, result, storedItemResults, onViewCorrection, viewed,
}: {
  released: boolean;
  result: CorrigerResult | null;
  storedItemResults?: CorrigerResult["correction"];
  onViewCorrection: () => void;
  viewed: boolean;
}) {
  if (!released) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        <p className="font-semibold">Exercice terminé — correction en attente</p>
        <p className="mt-1">Ton formateur libérera la correction bientôt. Tu peux continuer la séance en attendant.</p>
      </div>
    );
  }

  const correction = result?.correction ?? storedItemResults ?? [];
  return (
    <div className="space-y-3">
      {!viewed && (
        <Button size="sm" variant="outline" onClick={onViewCorrection}>Marquer la correction comme vue</Button>
      )}
      {correction.map((entry, index) => (
        <div key={index} className={`rounded-lg border p-3 text-sm ${entry.correct ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/20" : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20"}`}>
          <p className="font-medium">{entry.question}</p>
          <p className="mt-1">Ta réponse : <span className={entry.correct ? "text-green-700 dark:text-green-400" : "text-red-700 underline dark:text-red-400"}>{entry.reponse_eleve || "(vide)"}</span></p>
          {!entry.correct && <p className="text-blue-700 dark:text-blue-400">Réponse attendue : {entry.bonne_reponse}</p>}
          {entry.explication && <p className="mt-1 text-muted-foreground">{entry.explication}</p>}
        </div>
      ))}
    </div>
  );
}
