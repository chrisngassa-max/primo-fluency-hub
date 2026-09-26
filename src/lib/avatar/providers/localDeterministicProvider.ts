import type { PreparedAssistantRequest, PedagogicalLevel } from "../pedagogicalTypes";
import type { AssistantAiProvider, AssistantProviderResult } from "./types";

function tone(niveau: PedagogicalLevel, short: string, mid: string, long: string): string {
  if (niveau === "A1") return short;
  if (niveau === "A2") return mid;
  return long;
}

/**
 * Fournisseur local déterministe — 0 réseau, 0 clé, réponses stables pour tests.
 * S’appuie uniquement sur `PreparedAssistantRequest.sources` (corpus validé).
 */
export function createLocalDeterministicProvider(): AssistantAiProvider {
  return {
    id: "local_deterministic",
    available: true,
    async generate(request: PreparedAssistantRequest): Promise<AssistantProviderResult> {
      const { intent, niveau, session, exercice, sources, lecon } = request;
      const fact = sources.faits[0] ?? "Le parcours CapTCF a des étapes claires.";
      const lex = sources.lexique[0];
      const aide = sources.aides[0];
      const ctxEx = exercice
        ? `Exercice : ${exercice.titre}.`
        : "Exercice de la séance.";
      const ctxLecon = lecon ? `Leçon : ${lecon.titre}.` : "";

      switch (intent) {
        case "reformuler":
          return {
            uncertain: false,
            text: tone(
              niveau,
              `${ctxEx} En simple : ${fact}`,
              `${ctxEx} Autrement dit : ${fact} Objectif séance : ${session.objectifs[0] ?? session.titre}.`,
              `${ctxEx} ${ctxLecon} Reformulation : ${fact} Les objectifs de ${session.code} incluent : ${session.objectifs.slice(0, 2).join(" ; ")}.`,
            ),
          };
        case "donner_exemple":
          return {
            uncertain: false,
            text: tone(
              niveau,
              lex
                ? `Exemple : « ${lex.mot} » → ${lex.exemple}`
                : `Exemple simple : ${fact}`,
              lex
                ? `Exemple (${lex.mot}) : ${lex.exemple}. Autre fait utile : ${sources.faits[1] ?? fact}`
                : `Exemple : ${fact}`,
              lex
                ? `Exemple contextualisé (${session.code}) : ${lex.definition_simple} — ${lex.exemple}. Lien séance : ${session.objectifs[2] ?? session.objectifs[0]}.`
                : `Exemple avancé : ${fact}`,
            ),
          };
        case "fournir_indice":
          return {
            uncertain: false,
            text: tone(
              niveau,
              aide
                ? `Indice : ${aide}. Ne regarde pas le corrigé.`
                : `Indice : relis la consigne. Cherche le nombre d’heures ou de séances. Ne demande pas la réponse.`,
              aide
                ? `Indice (sans réponse) : ${aide}. Relis aussi : ${sources.faits[3] ?? fact}`
                : `Indice : compare droit / devoir / règle dans le dialogue. Je ne donne pas la réponse de l’évaluation.`,
              `Indice méthodologique : appuie-toi sur les faits validés de ${session.code} (durée, séances, E1/E2, notions droit-devoir-règle). Consigne : ${exercice?.consigne ?? "suis la consigne affichée"}. Pas de réponse complète.`,
            ),
          };
        case "proposer_mini_exercice":
          return {
            uncertain: false,
            text: tone(
              niveau,
              sources.mini_exercice ?? "Dis une phrase sur ton objectif.",
              `Mini-exercice (${niveau}) : ${sources.mini_exercice ?? "Écris deux phrases sur le parcours."}`,
              `Mini-exercice ${niveau} pour ${session.code} — ${ctxEx} ${sources.mini_exercice ?? "Argumente brièvement avantages/limites du parcours."}`,
            ),
          };
        case "expliquer":
        default:
          return {
            uncertain: false,
            text: tone(
              niveau,
              `${ctxEx} ${fact} ${lex ? `${lex.mot} = ${lex.definition_simple}` : ""}`.trim(),
              `${ctxEx} ${ctxLecon} ${fact} Objectif : ${session.objectifs[0]}. ${
                lex ? `${lex.mot} : ${lex.definition_simple}` : ""
              }`.trim(),
              `Contexte ${session.code} « ${session.titre} ». ${ctxLecon} ${ctxEx} ${fact} ` +
                `Notions : ${(sources.faits.slice(5, 8) || sources.faits.slice(0, 3)).join(" ")} ` +
                `Objectif prioritaire : ${session.objectifs[0]}.`,
            ),
          };
      }
    },
  };
}

/** Fournisseur indisponible — force le fallback FAQ dans l’orchestrateur. */
export function createUnavailableProvider(): AssistantAiProvider {
  return {
    id: "unavailable",
    available: false,
    async generate(): Promise<AssistantProviderResult> {
      throw new Error("Assistant provider unavailable");
    },
  };
}
