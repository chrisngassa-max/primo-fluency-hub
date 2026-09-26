import { FormEvent, useMemo, useState } from "react";
import { HelpCircle, MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  answerAvatarQuestion,
  type AvatarAnswer,
  type AvatarAnswerMode,
} from "@/lib/avatar/answerAvatarQuestion";
import { cn } from "@/lib/utils";

type Props = {
  /** Contexte page affiché uniquement en UI (jamais envoyé à une API). */
  pageHint?: string;
  className?: string;
};

/**
 * Prototype Avatar Q&A texte — FAQ CapTCF locale, réversible, 0 appel payant.
 */
export default function AvatarAssistantPanel({ pageHint, className }: Props) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [last, setLast] = useState<AvatarAnswer | null>(null);
  const [mode, setMode] = useState<AvatarAnswerMode>("answer");

  const reply = useMemo(() => {
    if (!last) return null;
    if (mode === "answer") return last;
    if (!question.trim() || last.refused || !last.entryId) return last;
    return answerAvatarQuestion(question, mode);
  }, [last, mode, question]);

  const ask = (event?: FormEvent) => {
    event?.preventDefault();
    setMode("answer");
    setLast(answerAvatarQuestion(question, "answer"));
  };

  return (
    <div className={cn("fixed bottom-24 right-4 z-40 lg:bottom-5", className)}>
      {!open ? (
        <Button
          type="button"
          size="sm"
          className="gap-2 shadow-lg"
          onClick={() => setOpen(true)}
          aria-label="Ouvrir l’assistant CapTCF"
        >
          <MessageCircle className="h-4 w-4" />
          Aide
        </Button>
      ) : (
        <section
          className="flex w-[min(100vw-2rem,22rem)] flex-col gap-3 rounded-xl border bg-white p-3 shadow-xl"
          aria-label="Assistant CapTCF FAQ"
        >
          <header className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e7e9f1] text-sm font-bold text-[#0b234a]"
                aria-hidden
              >
                CAP
              </span>
              <div>
                <p className="text-sm font-semibold text-[#0b234a]">Assistant CapTCF</p>
                <p className="text-[11px] text-muted-foreground">FAQ locale · sans IA payante</p>
              </div>
            </div>
            <button
              type="button"
              className="rounded p-1 text-muted-foreground hover:bg-muted"
              onClick={() => setOpen(false)}
              aria-label="Fermer l’assistant"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          {pageHint ? (
            <p className="rounded-md bg-muted/60 px-2 py-1 text-[11px] text-muted-foreground">
              Page : {pageHint}
            </p>
          ) : null}

          <form onSubmit={ask} className="flex flex-col gap-2">
            <label className="sr-only" htmlFor="captcf-avatar-q">
              Ta question
            </label>
            <textarea
              id="captcf-avatar-q"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={3}
              placeholder="Ex. : Je ne comprends pas la consigne…"
              className="w-full resize-none rounded-md border px-2 py-1.5 text-sm"
            />
            <Button type="submit" size="sm" className="w-full">
              Poser la question
            </Button>
          </form>

          {reply ? (
            <div className="space-y-2 rounded-md border bg-[#f8f9fc] p-2 text-sm">
              {reply.uncertain ? (
                <p className="flex items-center gap-1 text-[11px] font-medium text-amber-700">
                  <HelpCircle className="h-3.5 w-3.5" />
                  Réponse incertaine — FAQ limitée
                </p>
              ) : null}
              <p className="leading-snug text-[#0b234a]">{reply.text}</p>
              <p className="text-[10px] leading-snug text-muted-foreground">{reply.disclaimer}</p>
              {!reply.refused && reply.entryId ? (
                <div className="flex flex-wrap gap-1 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={mode === "reformulate" ? "default" : "outline"}
                    className="h-7 text-xs"
                    onClick={() => setMode("reformulate")}
                  >
                    Reformuler
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={mode === "example" ? "default" : "outline"}
                    className="h-7 text-xs"
                    onClick={() => setMode("example")}
                  >
                    Exemple
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled
                    title="Lot ultérieur — pas d’API traduction"
                  >
                    Ma langue (bientôt)
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}
