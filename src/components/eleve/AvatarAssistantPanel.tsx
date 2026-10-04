import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HelpCircle, MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAidePedagogique } from "@/contexts/AidePedagogiqueContext";
import { useAuth } from "@/contexts/AuthContext";
import { answerContextualQuestion } from "@/lib/avatar/answerContextualQuestion";
import type {
  ContextualAssistantAnswer,
  PedagogicalIntent,
} from "@/lib/avatar/pedagogicalTypes";
import {
  ASSISTANT_CONSENT_INFO,
  getAssistantAiConsent,
  setAssistantAiConsent,
  type AssistantConsentStatus,
} from "@/lib/avatar/assistantConsent";
import { cn } from "@/lib/utils";
import { isAccueilQuestion } from "../../../supabase/functions/_shared/assistant-accueil/orchestrate";
import { matchEleveRoute, sensitiveContextKey } from "@/lib/avatar/eleveRouteCatalog";
import { quickPromptsForPath } from "@/lib/avatar/answerPageOrientation";

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
 * Assistant pédagogique — contexte + consentement Aide + FAQ fallback.
 * Phase A : 0 appel payant (provider local ; Edge préparé mais flag live OFF).
 * Lot 2A.4 : visible sur tout l’espace élève via EleveLayout.
 */
async function loadOwnDevoirTitles(userId: string) {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data, error } = await supabase
      .from("devoirs")
      .select("id, statut, exercice:exercices!devoirs_exercice_id_fkey(titre)")
      .eq("eleve_id", userId)
      .limit(8);
    if (error || !data) return [];
    return data.flatMap((row) => {
      const statut = row.statut;
      if (statut !== "en_attente" && statut !== "fait" && statut !== "expire" && statut !== "arrete") {
        return [];
      }
      const linked = row.exercice as { titre?: string } | { titre?: string }[] | null;
      const titre = Array.isArray(linked) ? linked[0]?.titre : linked?.titre;
      return [{ id: row.id, titre: titre?.trim() || "Devoir", statut, eleveId: userId }];
    });
  } catch {
    return [];
  }
}

export default function AvatarAssistantPanel({ pageHint, className }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { context, setAideContext } = useAidePedagogique();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [last, setLast] = useState<ContextualAssistantAnswer | null>(null);
  const [busy, setBusy] = useState(false);
  const [activeIntent, setActiveIntent] = useState<PedagogicalIntent>("expliquer");
  const [consent, setConsent] = useState<AssistantConsentStatus>(() => getAssistantAiConsent());
  const requestNumber = useRef(0);
  const routeInfo = useMemo(() => matchEleveRoute(pageHint ?? null), [pageHint]);
  const isEvaluation = routeInfo?.family === "evaluation";
  const contextKey = JSON.stringify(context.pedagogical ?? null);
  const sensitiveKey = sensitiveContextKey(pageHint, user?.id);

  useEffect(() => {
    requestNumber.current += 1;
    setLast(null);
    setBusy(false);
    setQuestion("");
  }, [contextKey, sensitiveKey, user?.id]);

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

  const quickPrompts = useMemo(
    () => quickPromptsForPath(pageHint, Boolean(context.pedagogical)),
    [pageHint, context.pedagogical],
  );

  const decideConsent = (status: "accepted" | "refused") => {
    setAssistantAiConsent(status);
    setConsent(status);
  };

  const ask = async (event?: FormEvent, intent?: PedagogicalIntent, preset?: string, helpCategory?: "technique") => {
    event?.preventDefault();
    const chosen = intent ?? activeIntent;
    setActiveIntent(chosen);
    setBusy(true);
    const request = ++requestNumber.current;
    const askedQuestion = preset ?? question;
    try {
      const needsDevoirs = !context.pedagogical && user?.id && (
        isAccueilQuestion(askedQuestion)
        || /devoir|aujourd|seance|ensuite|maintenant|travailler/i.test(askedQuestion)
      );
      const ownDevoirs = needsDevoirs ? await loadOwnDevoirTitles(user.id) : [];
      const answer = await answerContextualQuestion(askedQuestion, context, {
        helpCategory,
        intent: chosen,
        authenticated: Boolean(user),
        assistantConsent: consent,
        allowLocalWithoutConsent: true,
        authUserId: user?.id ?? null,
        pagePath: pageHint ?? null,
        ownDevoirs,
      });
      if (request !== requestNumber.current) return;
      setLast(answer);
      if (answer.openRoute) navigate(answer.openRoute);
    } finally {
      if (request === requestNumber.current) setBusy(false);
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
          className="flex max-h-[min(70vh,32rem)] w-[min(100vw-2rem,22rem)] flex-col gap-3 overflow-y-auto rounded-xl border bg-white p-3 shadow-xl"
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
                  {isEvaluation ? "Aide technique pendant le test" : "Aide sur cette page"}
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

          {routeInfo ? (
            <p className="rounded-md bg-muted/60 px-2 py-1 text-[11px] text-muted-foreground">
              Page : {routeInfo.screen}
            </p>
          ) : pageHint ? (
            <p className="rounded-md bg-muted/60 px-2 py-1 text-[11px] text-muted-foreground">
              Page : {pageHint}
            </p>
          ) : null}

          {contextLine ? (
            <p className="rounded-md bg-muted/60 px-2 py-1 text-[11px] text-muted-foreground">
              Contexte : {contextLine}
            </p>
          ) : null}

          {context.pedagogical ? (
            <p className="text-[11px] text-muted-foreground">Cette aide utilise le contenu validé de l’exercice, sans appel à une IA.</p>
          ) : consent === "undecided" && !isEvaluation ? (
            <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] text-[#0b234a]">
              <p className="whitespace-pre-line leading-snug">{ASSISTANT_CONSENT_INFO}</p>
              <div className="flex flex-wrap gap-1">
                <Button
                  type="button"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => decideConsent("accepted")}
                >
                  J’accepte l’IA Aide
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => decideConsent("refused")}
                >
                  Refuser (FAQ seule)
                </Button>
              </div>
            </div>
          ) : !isEvaluation ? (
            <p className="text-[10px] text-muted-foreground">
              Consentement Aide : {consent === "accepted" ? "accepté" : "refusé — FAQ locale"}
              {" · "}
              <button
                type="button"
                className="underline"
                onClick={() => {
                  setConsent("undecided");
                }}
              >
                modifier
              </button>
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Pendant le test : pas d’indice, pas de correction. Aide pour utiliser l’écran seulement.
            </p>
          )}

          <form onSubmit={(e) => void ask(e)} className="flex flex-col gap-2">
            <label className="sr-only" htmlFor="captcf-avatar-q">
              Ta question
            </label>
            <textarea
              id="captcf-avatar-q"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={3}
              placeholder={isEvaluation ? "Ex. : Comment utiliser cet écran ?" : "Ex. : Où sont mes devoirs ?"}
              className="w-full resize-none rounded-md border px-2 py-1.5 text-sm"
            />
            <Button type="submit" size="sm" className="w-full" disabled={busy || !question.trim()}>
              {busy ? "…" : "Poser la question"}
            </Button>
          </form>

          <div className="flex flex-wrap gap-1" aria-label="Questions rapides">
            {quickPrompts.map((prompt) => (
              <Button
                key={prompt.id}
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                disabled={busy}
                onClick={() => void ask(undefined, undefined, prompt.question, prompt.technical ? "technique" : undefined)}
              >
                {prompt.label}
              </Button>
            ))}
          </div>

          {context.pedagogical && !isEvaluation ? (
            <>
              <div className="flex flex-wrap gap-1">
                {INTENT_BUTTONS.filter(({ intent }) => ["expliquer", "reformuler", "fournir_indice"].includes(intent)).map(({ intent, label }) => (
                  <Button
                    key={intent}
                    type="button"
                    size="sm"
                    variant={activeIntent === intent ? "default" : "outline"}
                    className="h-7 text-xs"
                    disabled={busy}
                    onClick={() => void ask(undefined, intent, intent === "fournir_indice" ? "Donne-moi un indice" : "Explique la consigne plus simplement")}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1">
                <p className="w-full text-[11px] text-muted-foreground">Aide de l’exercice sans IA — question {context.pedagogical.itemIndex + 1}</p>
                {(context.pedagogicalItemCount ?? 0) > 1 ? (
                  <label className="w-full text-xs">
                    Question concernée
                    <select className="ml-2 rounded border p-1" value={context.pedagogical.itemIndex} onChange={(event) => setAideContext({ pedagogical: { ...context.pedagogical!, itemIndex: Number(event.target.value) } })}>
                      {Array.from({ length: context.pedagogicalItemCount! }, (_, index) => <option key={index} value={index}>{index + 1}</option>)}
                    </select>
                  </label>
                ) : null}
                <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void ask(undefined, undefined, "J’ai besoin du professeur")}>
                  Demander au professeur
                </Button>
                <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void ask(undefined, undefined, "J’ai besoin du professeur", "technique")}>
                  Problème technique
                </Button>
              </div>
            </>
          ) : null}

          {busy && !last ? (
            <p role="status" className="text-[11px] text-muted-foreground">Recherche de l’aide…</p>
          ) : null}

          {last ? (
            <div className="space-y-2 rounded-md border bg-[#f8f9fc] p-2 text-sm">
              {last.uncertain ? (
                <p className="flex items-center gap-1 text-[11px] font-medium text-amber-700">
                  <HelpCircle className="h-3.5 w-3.5" />
                  Réponse limitée — sources ou FAQ
                </p>
              ) : null}
              {last.source === "faq" || last.provider === "faq_fallback" ? (
                <p
                  role="status"
                  data-provider="faq_fallback"
                  className="text-[11px] font-semibold text-amber-800"
                >
                  FAQ locale — provider=faq_fallback
                </p>
              ) : null}
              {last.refused ? (
                <p role="status" className="text-[11px] font-medium text-amber-800">Demande refusée</p>
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
