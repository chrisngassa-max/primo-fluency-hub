import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BookOpen, CheckCircle2, FlaskConical, Lock, RotateCcw, Unlock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import type { AttemptCorrectionResponse, LearnerActivity, LearnerExerciseBlock } from "@/lib/curriculum/learnerSession";
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

export default function S01DemoPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedLevel = searchParams.get("niveau");
  const level: DemoLevel = LEVELS.includes(requestedLevel as DemoLevel) ? requestedLevel as DemoLevel : "A2";
  const [activities, setActivities] = useState<LearnerActivity[]>([]);
  const [exercises, setExercises] = useState<LearnerExerciseBlock[]>([]);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [itemIndex, setItemIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [locked, setLocked] = useState<Set<number>>(new Set());
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [correction, setCorrection] = useState<AttemptCorrectionResponse | null>(null);
  const [loading, setLoading] = useState(true);

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
    setLocked(new Set());
    setAttemptId(null);
    setCorrection(null);
  }

  useEffect(() => {
    setExerciseIndex(0);
    resetRunner();
    void load();
  }, [level]);

  const exercise = exercises[exerciseIndex];
  const activity = activities.find((entry) => entry.id === exercise?.activity_id);
  const activityPosition = Math.max(0, activities.findIndex((entry) => entry.id === activity?.id));
  const currentItem = exercise?.items[itemIndex];
  const completed = Boolean(attemptId ?? exercise?.my_attempt?.attempt_id);

  const activityExerciseCounts = useMemo(() => {
    const counts = new Map<string, number>();
    exercises.forEach((entry) => counts.set(entry.activity_id ?? "", (counts.get(entry.activity_id ?? "") ?? 0) + 1));
    return counts;
  }, [exercises]);

  async function validateItem() {
    if (!exercise || !currentItem) return;
    setLocked((previous) => new Set(previous).add(itemIndex));
    if (itemIndex + 1 < exercise.items.length) {
      setItemIndex((value) => value + 1);
      return;
    }
    const submitted = await submitS01DemoAnswer({
      exerciseId: exercise.id,
      answers: Object.fromEntries(Object.entries(answers).map(([key, value]) => [String(key), value])),
    });
    setAttemptId(submitted.attempt_id);
    setCorrection(await fetchS01DemoCorrection(submitted.attempt_id));
    await load();
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
    markS01DemoCorrectionViewed(id);
    setCorrection(await fetchS01DemoCorrection(id));
  }

  async function goToExercise(nextIndex: number) {
    if (nextIndex < 0 || nextIndex >= exercises.length) return;
    setExerciseIndex(nextIndex);
    resetRunner();
    const existing = exercises[nextIndex].my_attempt?.attempt_id;
    if (existing) {
      setAttemptId(existing);
      setCorrection(await fetchS01DemoCorrection(existing));
    }
  }

  async function resetAll() {
    resetS01Demo();
    setExerciseIndex(0);
    resetRunner();
    await load();
  }

  if (loading || !exercise) {
    return <div className="min-h-screen bg-slate-50 p-8 text-center text-slate-600">Chargement de la démonstration S01…</div>;
  }

  const question = currentItem?.question ?? currentItem?.texte ?? currentItem?.enonce ?? `Question ${itemIndex + 1}`;
  const options = Array.isArray(currentItem?.options) ? currentItem.options : null;
  const correctionEntries = Object.values(correction?.item_results ?? {});

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

            {!completed && currentItem && (
              <div className="space-y-4">
                <p className="font-semibold">{question}</p>
                {options ? (
                  <RadioGroup value={answers[itemIndex] ?? ""} onValueChange={(value) => setAnswers((previous) => ({ ...previous, [itemIndex]: value }))} disabled={locked.has(itemIndex)}>
                    {options.map((option, index) => (
                      <div key={`${index}-${option}`} className="flex items-start gap-2 rounded-lg border bg-white p-3">
                        <RadioGroupItem value={option} id={`demo-${exerciseIndex}-${itemIndex}-${index}`} className="mt-0.5" />
                        <Label htmlFor={`demo-${exerciseIndex}-${itemIndex}-${index}`} className="cursor-pointer leading-5">{option}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                ) : (
                  <Textarea value={answers[itemIndex] ?? ""} onChange={(event) => setAnswers((previous) => ({ ...previous, [itemIndex]: event.target.value }))} placeholder="Ta réponse…" />
                )}
                <Button className="gap-2 bg-blue-700 hover:bg-blue-800" disabled={!(answers[itemIndex] ?? "").trim()} onClick={() => void validateItem()}>
                  <CheckCircle2 className="h-4 w-4" /> Valider ma réponse
                </Button>
              </div>
            )}

            {completed && (!correction || !correction.released) && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                <p className="flex items-center gap-2 font-bold"><Lock className="h-4 w-4" /> Exercice terminé — correction en attente</p>
                <p className="mt-1">Dans l’application réelle, seul le formateur peut libérer cette correction.</p>
                <Button size="sm" className="mt-3 gap-1 bg-amber-700 hover:bg-amber-800" onClick={() => void releaseCorrection()}>
                  <Unlock className="h-3.5 w-3.5" /> Simuler la libération formateur
                </Button>
              </div>
            )}

            {correction?.released && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2"><Badge className="bg-emerald-700">Score {correction.score_normalized}%</Badge>{!correction.correction_viewed_at && <Button size="sm" variant="outline" onClick={() => void viewCorrection()}>Marquer comme vue</Button>}</div>
                {correctionEntries.map((entry, index) => (
                  <div key={index} className={`rounded-lg border p-3 text-sm ${entry.correct ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
                    <p className="font-semibold">{entry.question}</p>
                    <p>Ta réponse : <span className={entry.correct ? "text-emerald-700" : "text-red-700 underline"}>{entry.reponse_donnee || "(vide)"}</span></p>
                    {!entry.correct && <p className="text-blue-800">Réponse attendue : {entry.bonne_reponse}</p>}
                    {entry.explication && <p className="mt-1 text-slate-600">{entry.explication}</p>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-between gap-3">
          <Button variant="outline" disabled={exerciseIndex === 0} onClick={() => void goToExercise(exerciseIndex - 1)}>Exercice précédent</Button>
          <Button className="bg-blue-700 hover:bg-blue-800" disabled={!completed || exerciseIndex === exercises.length - 1} onClick={() => void goToExercise(exerciseIndex + 1)}>Exercice suivant</Button>
        </div>
      </div>
    </main>
  );
}
