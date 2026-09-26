import { FormEvent, useMemo, useState } from "react";
import { HelpCircle, MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAidePedagogique } from "@/contexts/AidePedagogiqueContext";
import {
  answerContextualQuestion,
} from "@/lib/avatar/answerContextualQuestion";
import type {
  ContextualAssistantAnswer,
  PedagogicalIntent,
} from "@/lib/avatar/pedagogicalTypes";
import { cn } from "@/lib/utils";

type Props = {
  /** Contexte page affiché uniquement en UI (jamais envoyé à une API). */
  pageHint?: string;
  className?: string;
};

const INTENT_BUTTONS: { intent: PedagogicalIntent; label: string }[] = [
  { intent: "expliquer", label: "Expliquer" },
  { intent: "reformuler", label: "Reformuler" },
  { intent: "donner_exemple", label: "Exemple" },
  { intent: "fournir_indice", label: "Indice" },
  { intent: "proposer_mini_exercice", label: "Mini-exercice" },
];

/**
 * Assistant pédagogique textuel — contexte séance/exercice + FAQ fallback.
 * Lot 3B-2 : fournisseur local déterministe, 0 appel payant.
 */
export default function AvatarAssistantPanel({ pageHint, className }: Props) {
  const { context } = useAidePedagogique();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [last, setLast] = useState<ContextualAssistantAnswer | null>(null);
  const [busy, setBusy] = useState(false);
  const [activeIntent, setActiveIntent] = useState<PedagogicalIntent>("expliquer");

  const contextLine = useMemo(() => {
    const parts = [
      context.sessionCode ? `${context.sessionCode}` : null,
      context.sessionTitre,
      context.niveau ? `niv. ${context.niveau}` : null,
      context.leconTitre ? `leçon : ${context.leconTitre}` : null,
      context.exerciceTitre ? `exo : ${context.exerciceTitre}` : null,
    ].filter(Boolean);
    return parts.length ? parts.join(" · ") : null;
  }, [context]);

  const ask = async (event?: FormEvent, intent?: PedagogicalIntent) => {
    event?.preventDefault();
    const chosen = intent ?? activeIntent;
    setActiveIntent(chosen);
    setBusy(true);
    try {
      const answer = await answerContextualQuestion(question, context, { intent: chosen });
      setLast(answer);
    } finally {
      setBusy(false);
    }
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
          aria-label="Assistant CapTCF contextuel"
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
                <p className="text-[11px] text-muted-foreground">
                  S01 contextuel · local (pas d’IA payante)
                </p>
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

          {contextLine ? (
            <p className="rounded-md bg-muted/60 px-2 py-1 text-[11px] text-muted-foreground">
              Contexte : {contextLine}
            </p>
          ) : pageHint ? (
            <p className="rounded-md bg-muted/60 px-2 py-1 text-[11px] text-muted-foreground">
              Page : {pageHint}
            </p>
          ) : null}

          <form onSubmit={(e) => void ask(e)} className="flex flex-col gap-2">
            <label className="sr-only" htmlFor="captcf-avatar-q">
              Ta question
            </label>
            <textarea
              id="captcf-avatar-q"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={3}
              placeholder="Ex. : Explique la consigne de cet exercice…"
              className="w-full resize-none rounded-md border px-2 py-1.5 text-sm"
            />
            <Button type="submit" size="sm" className="w-full" disabled={busy}>
              {busy ? "…" : "Poser la question"}
            </Button>
          </form>

          <div className="flex flex-wrap gap-1">
            {INTENT_BUTTONS.map(({ intent, label }) => (
              <Button
                key={intent}
                type="button"
                size="sm"
                variant={activeIntent === intent ? "default" : "outline"}
                className="h-7 text-xs"
                disabled={busy || !question.trim()}
                onClick={() => void ask(undefined, intent)}
              >
                {label}
              </Button>
            ))}
          </div>

          {last ? (
            <div className="space-y-2 rounded-md border bg-[#f8f9fc] p-2 text-sm">
              {last.uncertain ? (
                <p className="flex items-center gap-1 text-[11px] font-medium text-amber-700">
                  <HelpCircle className="h-3.5 w-3.5" />
                  Réponse limitée — sources ou FAQ
                </p>
              ) : null}
              {last.source === "faq" ? (
                <p className="text-[11px] text-muted-foreground">Fallback FAQ locale</p>
              ) : null}
              <p className="leading-snug text-[#0b234a]">{last.text}</p>
              <p className="text-[10px] leading-snug text-muted-foreground">{last.disclaimer}</p>
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}
