import { BookOpenCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { WorkedExample } from "@/lib/curriculum/learnerSession";

function HighlightedQuestion({ text, highlightedText }: { text: string; highlightedText?: string }) {
  if (!highlightedText) return <>{text}</>;
  const start = text.indexOf(highlightedText);
  if (start < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, start)}
      <span className="rounded-sm bg-yellow-100 px-0.5 font-bold underline decoration-2 underline-offset-4">
        {highlightedText}
      </span>
      {text.slice(start + highlightedText.length)}
    </>
  );
}

export function WorkedExamplePanel({ example }: { example?: WorkedExample | null }) {
  if (!example) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="gap-2 border-blue-300 text-blue-800 hover:bg-blue-50">
          <BookOpenCheck className="h-4 w-4" />
          Voir un exemple corrigé
        </Button>
      </DialogTrigger>
      <DialogContent className="h-[100dvh] max-h-[100dvh] w-screen max-w-none overflow-y-auto rounded-none p-5 sm:h-auto sm:max-h-[85vh] sm:w-full sm:max-w-xl sm:rounded-lg sm:p-6">
        <DialogHeader>
          <DialogTitle>Exemple corrigé — niveau {example.level}</DialogTitle>
          <DialogDescription>
            Cet exemple utilise un autre contenu que les questions évaluées.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <section className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-950">
            <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Ce qu’il faut faire</p>
            <p className="mt-1 font-medium">{example.instruction}</p>
          </section>

          <section className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Question d’exemple</p>
            <p className="font-semibold text-slate-950">
              <HighlightedQuestion text={example.question} highlightedText={example.highlighted_text} />
            </p>
            {example.options?.length ? (
              <ul className="space-y-1 pl-5 text-slate-700">
                {example.options.map((option) => <li key={option} className="list-disc">{option}</li>)}
              </ul>
            ) : null}
          </section>

          <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Réponse de l’exemple</p>
            <p className="mt-1 font-semibold">{example.response}</p>
            {example.completed_response && example.completed_response !== example.response ? (
              <p className="mt-2">{example.completed_response}</p>
            ) : null}
          </section>

          <section>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Comment trouver la réponse</p>
            <ol className="mt-2 space-y-2">
              {example.explanation_steps.map((step, index) => (
                <li key={`${index}-${step}`} className="flex gap-2">
                  <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-blue-700 text-xs font-bold text-white">
                    {index + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
