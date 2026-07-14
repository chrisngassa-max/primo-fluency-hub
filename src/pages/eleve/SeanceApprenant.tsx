import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Layers3, Lock } from "lucide-react";
import {
  fetchAttemptCorrection,
  fetchSeanceContent,
  markCorrectionViewed,
  submitSeanceAnswer,
  type LearnerExerciseBlock,
  type LearnerSessionBlock,
} from "@/lib/curriculum/learnerSession";
import { sanitizeSeanceHtml } from "@/lib/curriculum/sanitizeHtml";
import { buildStructuredAnswer, isJustificationMissing } from "@/lib/curriculum/justificationAnswer";
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
 * séparée S01InteractiveExercises. REVU après relecture indépendante
 * (2026-07-13) : ne lit plus jamais exercices.contenu ni session_documents
 * directement — tout passe par get-seance-content (contenu nettoyé, jamais
 * de bonne_reponse) et submit-seance-answer (score calculé serveur,
 * jamais renvoyé avant libération formateur).
 */
export default function SeanceApprenant() {
  const { sessionCode = "" } = useParams<{ sessionCode: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activityIndex, setActivityIndex] = useState(0);
  const [blockIndex, setBlockIndex] = useState(0);
  const [itemIndex, setItemIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  // Justification saisie séparément de la réponse principale (Lot 2,
  // contrat B1/B2) — jamais fusionnée dans `answers` avant la soumission,
  // pour ne jamais perdre l'une en modifiant l'autre.
  const [justifications, setJustifications] = useState<Record<number, string>>({});
  const [lockedItems, setLockedItems] = useState<Set<number>>(new Set());
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [justificationError, setJustificationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["seance-apprenant-content", sessionCode],
    queryFn: () => fetchSeanceContent(sessionCode),
    enabled: !!sessionCode,
  });

  const activities = data?.activities ?? [];
  const blocks = data?.blocks ?? [];

  const activityGroups = useMemo(() => {
    const byActivity = new Map<string | null, LearnerSessionBlock[]>();
    for (const block of blocks) {
      const key = block.activity_id;
      if (!byActivity.has(key)) byActivity.set(key, []);
      byActivity.get(key)!.push(block);
    }
    return activities
      .filter((activity) => (byActivity.get(activity.id) ?? []).length > 0)
      .map((activity) => ({ activity, blocks: byActivity.get(activity.id) ?? [] }));
  }, [activities, blocks]);

  const currentGroup = activityGroups[activityIndex];
  const currentBlock = currentGroup?.blocks[blockIndex];
  const currentExercise = currentBlock?.kind === "exercise" ? (currentBlock as LearnerExerciseBlock) : null;
  const currentAttemptId = currentExercise?.my_attempt?.attempt_id ?? null;

  const { data: correction, isLoading: loadingCorrection } = useQuery({
    queryKey: ["seance-apprenant-correction", currentAttemptId],
    queryFn: () => fetchAttemptCorrection(currentAttemptId!),
    enabled: !!currentAttemptId,
  });

  function resetExerciseNav() {
    setItemIndex(0);
    setAnswers({});
    setJustifications({});
    setLockedItems(new Set());
    setJustSubmitted(false);
    setJustificationError(null);
    setSubmitError(null);
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
  const isLastBlock = currentGroup ? (activityIndex === activityGroups.length - 1 && blockIndex === currentGroup.blocks.length - 1) : false;

  async function handleValidateItem() {
    if (!currentExercise) return;
    const items = currentExercise.items;
    const item = items[itemIndex] as { justification_required?: boolean; justification_prompt?: string } | undefined;

    // Erreur pédagogique explicite : la justification est obligatoire pour
    // ce contrat (B1/B2) et n'a pas été saisie. La réponse principale déjà
    // tapée (answers[itemIndex]) n'est jamais effacée — on bloque juste la
    // progression tant qu'elle manque. Même logique que le garde-fou serveur
    // (findMissingRequiredJustifications), appliquée ici côté client pour un
    // retour immédiat.
    if (item && isJustificationMissing(item, justifications[itemIndex] ?? "")) {
      setJustificationError("Merci de justifier votre réponse avant de valider.");
      return;
    }
    setJustificationError(null);

    setLockedItems((prev) => new Set(prev).add(itemIndex));
    if (itemIndex + 1 < items.length) {
      setItemIndex((i) => i + 1);
      return;
    }

    // Dernier item : envoi au serveur. Aucune correction/score reçu ici —
    // uniquement une confirmation de complétion (voir submitSeanceAnswer).
    // Score et correction sont TOUJOURS recalculés côté serveur ; ce client
    // n'envoie jamais de score.
    const allIndexes = new Set([...Object.keys(answers), ...Object.keys(justifications)].map(Number));
    const payloadAnswers = Object.fromEntries(
      [...allIndexes].map((idx) => [idx, buildStructuredAnswer(answers[idx] ?? "", justifications[idx] ?? "")]),
    );

    try {
      const submitted = await submitSeanceAnswer({
        exerciseId: currentExercise.id,
        sessionCode,
        answers: payloadAnswers,
      });
      setSubmitError(null);
      setJustSubmitted(true);
      queryClient.setQueryData(
        ["seance-apprenant-correction", submitted.attempt_id],
        { attempt_id: submitted.attempt_id, status: submitted.status, released: false },
      );
      await queryClient.invalidateQueries({ queryKey: ["seance-apprenant-content", sessionCode] });
    } catch (error) {
      // Rejet serveur (ex. JUSTIFICATION_REQUISE en défense en profondeur) :
      // on déverrouille le dernier item pour permettre de corriger, et on ne
      // touche ni à `answers` ni à `justifications` — rien n'est perdu.
      setLockedItems((prev) => {
        const next = new Set(prev);
        next.delete(itemIndex);
        return next;
      });
      setSubmitError(
        error instanceof Error
          ? error.message
          : "La soumission a échoué. Vérifie tes réponses (et justifications si demandées) puis réessaie.",
      );
    }
  }

  async function handleViewCorrection() {
    if (correction?.attempt_id && correction.released && !correction.correction_viewed_at) {
      await markCorrectionViewed(correction.attempt_id);
      queryClient.invalidateQueries({ queryKey: ["seance-apprenant-correction", correction.attempt_id] });
    }
  }

  const attemptCompleted = justSubmitted || !!currentExercise?.my_attempt;

  if (isLoading) {
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
            <div dangerouslySetInnerHTML={{ __html: sanitizeSeanceHtml(currentBlock.content_html) }} />
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
                  {!attemptCompleted && ` — Question ${Math.min(itemIndex + 1, currentExercise.items.length)} sur ${currentExercise.items.length}`}
                </p>
                <p className="font-semibold">{currentExercise.titre}</p>
              </div>
              <div className="flex gap-1.5">
                <Badge variant="outline">{currentExercise.niveau_vise}</Badge>
                <Badge variant="outline">{currentExercise.competence}</Badge>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{currentExercise.consigne}</p>

            {loadingCorrection ? (
              <Skeleton className="h-24" />
            ) : attemptCompleted ? (
              <CorrectionGate
                correction={correction ?? null}
                onViewCorrection={handleViewCorrection}
              />
            ) : (
              <>
                <ExerciseItemForm
                  item={currentExercise.items[itemIndex]}
                  index={itemIndex}
                  total={currentExercise.items.length}
                  locked={lockedItems.has(itemIndex)}
                  value={answers[itemIndex] ?? ""}
                  onChange={(value) => setAnswers((prev) => ({ ...prev, [itemIndex]: value }))}
                  justificationValue={justifications[itemIndex] ?? ""}
                  onJustificationChange={(value) => {
                    setJustifications((prev) => ({ ...prev, [itemIndex]: value }));
                    if (justificationError) setJustificationError(null);
                  }}
                  justificationError={justificationError}
                  onValidate={handleValidateItem}
                />
                {submitError && (
                  <p className="text-sm text-red-700 dark:text-red-400">{submitError}</p>
                )}
              </>
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

export function ExerciseItemForm({
  item, index, total, locked, value, onChange,
  justificationValue, onJustificationChange, justificationError, onValidate,
}: {
  item: {
    question?: string; texte?: string; enonce?: string; options?: string[];
    justification_prompt?: string; justification_required?: boolean;
  };
  index: number;
  total: number;
  locked: boolean;
  value: string;
  onChange: (value: string) => void;
  justificationValue: string;
  onJustificationChange: (value: string) => void;
  justificationError?: string | null;
  onValidate: () => void;
}) {
  const question = item.question ?? item.texte ?? item.enonce ?? `Question ${index + 1}`;
  const options = Array.isArray(item.options) ? item.options : null;
  const needsJustification = Boolean(item.justification_prompt);
  // Le bouton reste cliquable dès que la réponse principale est saisie,
  // même si la justification obligatoire manque : c'est handleValidateItem
  // (au clic) qui bloque la progression et affiche une erreur pédagogique
  // EXPLICITE (justificationError) plutôt qu'un bouton silencieusement
  // désactivé sans message.
  const canValidate = value.trim().length > 0;

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

      {needsJustification && (
        <div className="space-y-1.5">
          <Label htmlFor={`justification-${index}`} className="flex items-center gap-1 text-sm">
            {item.justification_prompt}
            {item.justification_required && <span aria-hidden="true" className="text-red-600">*</span>}
          </Label>
          <Textarea
            id={`justification-${index}`}
            value={justificationValue}
            onChange={(e) => onJustificationChange(e.target.value)}
            disabled={locked}
            placeholder="Ta justification..."
          />
        </div>
      )}
      {justificationError && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">{justificationError}</p>
      )}

      {!locked && (
        <Button onClick={onValidate} disabled={!canValidate} className="gap-2 bg-blue-600 hover:bg-blue-700">
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

export function CorrectionGate({
  correction, onViewCorrection,
}: {
  correction: Awaited<ReturnType<typeof fetchAttemptCorrection>> | null;
  onViewCorrection: () => void;
}) {
  if (!correction || !correction.released) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        <p className="font-semibold">Exercice terminé — correction en attente</p>
        <p className="mt-1">Ta réponse est bien enregistrée. Ton formateur libérera la correction bientôt. Tu peux continuer la séance en attendant.</p>
      </div>
    );
  }

  const entries = Object.values(correction.item_results ?? {});
  return (
    <div className="space-y-3">
      {!correction.correction_viewed_at && (
        <Button size="sm" variant="outline" onClick={onViewCorrection}>Marquer la correction comme vue</Button>
      )}
      {entries.map((entry, index) => (
        <div key={index} className={`rounded-lg border p-3 text-sm ${entry.correct ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/20" : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20"}`}>
          <p className="font-medium">{entry.question}</p>
          <p className="mt-1">Ta réponse : <span className={entry.correct ? "text-green-700 dark:text-green-400" : "text-red-700 underline dark:text-red-400"}>{entry.reponse_donnee || "(vide)"}</span></p>
          {entry.learner_justification && (
            <p className="mt-1">Ta justification : <span className="text-muted-foreground">{entry.learner_justification}</span></p>
          )}
          {!entry.correct && <p className="text-blue-700 dark:text-blue-400">Réponse attendue : {entry.bonne_reponse}</p>}
          {entry.explication && <p className="mt-1 text-muted-foreground">{entry.explication}</p>}
        </div>
      ))}
    </div>
  );
}
