import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BookOpen, CheckCircle2, ChevronDown, ChevronUp, FlaskConical, ListChecks, RotateCcw, Unlock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { AttemptCorrectionResponse, LearnerActivity, LearnerExerciseBlock } from "@/lib/curriculum/learnerSession";
import { buildStructuredAnswer, isJustificationMissing } from "@/lib/curriculum/justificationAnswer";
// Lot 2.1, point 4 : réutilise le RENDU RÉEL du parcours apprenant (mêmes
// composants que SeanceApprenant.tsx) — indice sur demande, banque de
// mots, justification obligatoire, restitution post-libération. Aucune
// logique de rendu parallèle recréée ici.
import { ExerciseItemForm, CorrectionGate } from "@/pages/eleve/SeanceApprenant";
import { WorkedExamplePanel } from "@/components/learner/WorkedExamplePanel";
import {
  fetchS01DemoContent,
  fetchS01DemoCorrection,
  markS01DemoCorrectionViewed,
  releaseS01DemoCorrection,
  resetS01Demo,
  submitS01DemoAnswer,
  type DemoLevel,
} from "@/lib/curriculum/s01Demo";

const LEVELS: DemoLevel[] = ["A1", "A2", "B1", "B2"];

type ExerciseDraft = {
  itemIndex: number;
  answers: Record<number, string>;
  justifications: Record<number, string>;
  hintsRevealed: Record<number, boolean>;
  locked: number[];
};

export default function S01DemoPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedLevel = searchParams.get("niveau");
  const level: DemoLevel = LEVELS.includes(requestedLevel as DemoLevel) ? requestedLevel as DemoLevel : "A2";
  const [activities, setActivities] = useState<LearnerActivity[]>([]);
  const [exercises, setExercises] = useState<LearnerExerciseBlock[]>([]);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [itemIndex, setItemIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [justifications, setJustifications] = useState<Record<number, string>>({});
  const [hintsRevealed, setHintsRevealed] = useState<Record<number, boolean>>({});
  const [locked, setLocked] = useState<Set<number>>(new Set());
  const [justificationError, setJustificationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [correction, setCorrection] = useState<AttemptCorrectionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showExerciseList, setShowExerciseList] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, ExerciseDraft>>({});

  async function load() {
    setLoading(true);
    const data = await fetchS01DemoContent(level);
    setActivities(data.activities);
    setExercises(data.blocks.filter((block): block is LearnerExerciseBlock => block.kind === "exercise"));
    setLoading(false);
  }

  function resetRunner() {
    setItemIndex(0);
    setAnswers({});
    setJustifications({});
    setHintsRevealed({});
    setLocked(new Set());
    setJustificationError(null);
    setSubmitError(null);
    setAttemptId(null);
    setCorrection(null);
  }

  useEffect(() => {
    setExerciseIndex(0);
    setDrafts({});
    resetRunner();
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

  const exercise = exercises[exerciseIndex];
  const activity = activities.find((entry) => entry.id === exercise?.activity_id);
  const activityPosition = Math.max(0, activities.findIndex((entry) => entry.id === activity?.id));
  const currentItem = exercise?.items[itemIndex] as
    | { justification_required?: boolean; justification_prompt?: string }
    | undefined;
  const completed = Boolean(attemptId ?? exercise?.my_attempt?.attempt_id);

  const activityExerciseCounts = useMemo(() => {
    const counts = new Map<string, number>();
    exercises.forEach((entry) => counts.set(entry.activity_id ?? "", (counts.get(entry.activity_id ?? "") ?? 0) + 1));
    return counts;
  }, [exercises]);

  async function validateItem() {
    if (!exercise || !currentItem) return;

    // Même garde-fou pédagogique explicite que le parcours réel : la
    // réponse principale n'est jamais effacée.
    if (isJustificationMissing(currentItem, justifications[itemIndex] ?? "")) {
      setJustificationError("Merci de justifier votre réponse avant de valider.");
      return;
    }
    setJustificationError(null);

    setLocked((previous) => new Set(previous).add(itemIndex));
    if (itemIndex + 1 < exercise.items.length) {
      setItemIndex((value) => value + 1);
      return;
    }

    const allIndexes = new Set(
      [...Object.keys(answers), ...Object.keys(justifications), ...Object.keys(hintsRevealed)].map(Number),
    );
    const payloadAnswers = Object.fromEntries(
      [...allIndexes].map((idx) => [
        idx,
        buildStructuredAnswer(answers[idx] ?? "", justifications[idx] ?? "", hintsRevealed[idx] === true),
      ]),
    );

    try {
      const submitted = await submitS01DemoAnswer({ exerciseId: exercise.id, answers: payloadAnswers });
      setSubmitError(null);
      setAttemptId(submitted.attempt_id);
      setDrafts((previous) => {
        const next = { ...previous };
        delete next[exercise.id];
        return next;
      });
      setCorrection(await fetchS01DemoCorrection(submitted.attempt_id));
      await load();
    } catch (error) {
      setLocked((previous) => {
        const next = new Set(previous);
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

  async function releaseCorrection() {
    const id = attemptId ?? exercise?.my_attempt?.attempt_id;
    if (!id) return;
    releaseS01DemoCorrection(id);
    setCorrection(await fetchS01DemoCorrection(id));
    await load();
  }

  async function viewCorrection() {
    const id = correction?.attempt_id;
    if (!id) return;
    await markS01DemoCorrectionViewed(id);
    setCorrection(await fetchS01DemoCorrection(id));
  }

  async function goToExercise(nextIndex: number) {
    if (nextIndex < 0 || nextIndex >= exercises.length || nextIndex === exerciseIndex) return;

    if (exercise && !completed) {
      setDrafts((previous) => ({
        ...previous,
        [exercise.id]: {
          itemIndex,
          answers,
          justifications,
          hintsRevealed,
          locked: [...locked],
        },
      }));
    }

    const target = exercises[nextIndex];
    const saved = drafts[target.id];
    setExerciseIndex(nextIndex);
    setItemIndex(saved?.itemIndex ?? 0);
    setAnswers(saved?.answers ?? {});
    setJustifications(saved?.justifications ?? {});
    setHintsRevealed(saved?.hintsRevealed ?? {});
    setLocked(new Set(saved?.locked ?? []));
    setJustificationError(null);
    setSubmitError(null);
    setAttemptId(null);
    setCorrection(null);

    const existing = target.my_attempt?.attempt_id;
    if (existing) {
      setAttemptId(existing);
      setCorrection(await fetchS01DemoCorrection(existing));
    }
  }

  async function resetAll() {
    resetS01Demo();
    setExerciseIndex(0);
    setDrafts({});
    resetRunner();
    await load();
  }

  if (loading || !exercise) {
    return <div className="min-h-screen bg-slate-50 p-8 text-center text-slate-600">Chargement de la démonstration S01…</div>;
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,#dbeafe,transparent_35%),#f8fafc] px-4 py-6 text-slate-950">
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <Badge className="gap-1 bg-amber-700"><FlaskConical className="h-3.5 w-3.5" /> Démonstration S01</Badge>
            <span className="text-sm text-amber-950">Simulation locale : aucune donnée envoyée à Supabase.</span>
            <label className="ml-auto flex items-center gap-2 text-sm font-semibold text-amber-950">
              Niveau
              <select
                className="h-9 rounded-md border border-amber-300 bg-white px-2"
                value={level}
                onChange={(event) => setSearchParams({ niveau: event.target.value })}
              >
                {LEVELS.map((entry) => <option key={entry}>{entry}</option>)}
              </select>
            </label>
            <Button size="sm" variant="outline" className="gap-1 border-amber-300" onClick={() => void resetAll()}>
              <RotateCcw className="h-3.5 w-3.5" /> Réinitialiser
            </Button>
          </div>
        </div>

        <header className="space-y-2">
          <div className="flex items-center gap-2">
            <BookOpen className="h-7 w-7 text-blue-700" />
            <div>
              <h1 className="text-2xl font-extrabold text-[#0b234a]">Séance S01 — parcours apprenant interactif</h1>
              <p className="text-sm text-slate-600">{exercises.length} exercices adaptés au niveau {level}</p>
            </div>
          </div>
          <Progress value={((exerciseIndex + 1) / exercises.length) * 100} />
        </header>

        <div className="flex flex-wrap gap-2">
          {activities.map((entry, index) => (
            <Badge key={entry.id} variant={entry.id === activity?.id ? "default" : "outline"} className={entry.id === activity?.id ? "bg-blue-700" : "bg-white"}>
              {index + 1}. {entry.title} ({activityExerciseCounts.get(entry.id) ?? 0})
            </Badge>
          ))}
        </div>

        <Card className="border-slate-200 bg-white/90 shadow-sm">
          <CardContent className="p-4">
            <button
              type="button"
              className="flex w-full items-center gap-2 text-left font-bold text-[#0b234a]"
              onClick={() => setShowExerciseList((value) => !value)}
              aria-expanded={showExerciseList}
            >
              <ListChecks className="h-5 w-5 text-blue-700" />
              Parcourir les {exercises.length} exercices du niveau {level}
              {showExerciseList ? <ChevronUp className="ml-auto h-4 w-4" /> : <ChevronDown className="ml-auto h-4 w-4" />}
            </button>
            <p className="mt-1 text-xs text-slate-600">Clique sur un intitulé pour prévisualiser l’exercice, sans avoir besoin de terminer le précédent.</p>
            {showExerciseList && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {exercises.map((entry, index) => {
                  const active = index === exerciseIndex;
                  const done = Boolean(entry.my_attempt?.attempt_id);
                  return (
                    <button
                      type="button"
                      key={entry.id}
                      onClick={() => void goToExercise(index)}
                      aria-current={active ? "true" : undefined}
                      className={`flex min-h-14 items-start gap-2 rounded-lg border p-2.5 text-left text-sm transition ${active ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600" : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/50"}`}
                    >
                      <span className={`flex h-6 min-w-6 items-center justify-center rounded-full text-xs font-bold ${active ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-700"}`}>{index + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-slate-900">{entry.titre}</span>
                        <span className="mt-0.5 block text-xs text-slate-500">{entry.competence} · {entry.format.replaceAll("_", " ")} · {entry.items.length} item(s)</span>
                      </span>
                      {done && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-label="Exercice terminé" />}
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-blue-100 shadow-lg">
          <CardContent className="space-y-5 p-5 sm:p-7">
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-blue-700">
                  Activité {activityPosition + 1}/{activities.length} · Exercice {exerciseIndex + 1}/{exercises.length}
                  {!completed && ` · Item ${itemIndex + 1}/${exercise.items.length}`}
                </p>
                <h2 className="mt-1 text-xl font-bold">{exercise.titre}</h2>
              </div>
              <div className="flex gap-1.5"><Badge variant="outline">{exercise.niveau_vise}</Badge><Badge variant="outline">{exercise.competence}</Badge><Badge variant="outline">{exercise.format.replaceAll("_", " ")}</Badge></div>
            </div>
            <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-950">{exercise.consigne}</p>

            <WorkedExamplePanel example={exercise.worked_example} />

            {!completed && currentItem && (
              <>
                <ExerciseItemForm
                  item={currentItem}
                  index={itemIndex}
                  total={exercise.items.length}
                  locked={locked.has(itemIndex)}
                  value={answers[itemIndex] ?? ""}
                  onChange={(value) => setAnswers((previous) => ({ ...previous, [itemIndex]: value }))}
                  justificationValue={justifications[itemIndex] ?? ""}
                  onJustificationChange={(value) => {
                    setJustifications((previous) => ({ ...previous, [itemIndex]: value }));
                    if (justificationError) setJustificationError(null);
                  }}
                  justificationError={justificationError}
                  hintRevealed={hintsRevealed[itemIndex] === true}
                  onRevealHint={() => setHintsRevealed((previous) => ({ ...previous, [itemIndex]: true }))}
                  onValidate={() => void validateItem()}
                />
                {submitError && <p className="text-sm text-red-700">{submitError}</p>}
              </>
            )}

            {completed && (!correction || !correction.released) && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                <p className="flex items-center gap-2 font-bold"><Unlock className="h-4 w-4" /> Exercice terminé — correction en attente</p>
                <p className="mt-1">Dans l’application réelle, seul le formateur peut libérer cette correction.</p>
                <Button size="sm" className="mt-3 gap-1 bg-amber-700 hover:bg-amber-800" onClick={() => void releaseCorrection()}>
                  <Unlock className="h-3.5 w-3.5" /> Simuler la libération formateur
                </Button>
              </div>
            )}

            {correction?.released && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-emerald-700">
                    Score {correction.score_normalized}%{(correction as { score_provisional?: boolean }).score_provisional && " (provisoire)"}
                  </Badge>
                </div>
                <CorrectionGate correction={correction} onViewCorrection={() => void viewCorrection()} />
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-between gap-3">
          <Button variant="outline" disabled={exerciseIndex === 0} onClick={() => void goToExercise(exerciseIndex - 1)}>Exercice précédent</Button>
          <Button className="bg-blue-700 hover:bg-blue-800" disabled={exerciseIndex === exercises.length - 1} onClick={() => void goToExercise(exerciseIndex + 1)}>Exercice suivant</Button>
        </div>
      </div>
    </main>
  );
}
