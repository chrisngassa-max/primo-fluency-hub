import { ASSISTANT_TOOLS, type AssistantTool } from '../assistant-accueil/contract-v1.ts';
import { deliverValidatedHint } from './banks/deliver-hint.ts';
import { loadContext, type Context, type Dependencies } from './load.ts';
import { object, string, type Row } from './store.ts';
export type { DataStore } from './store.ts';

const COMPETENCES: Record<string, string> = { CO: 'compréhension orale', CE: 'compréhension écrite', EO: 'expression orale', EE: 'expression écrite' };

/** Liste blanche fermée : pas de question, instruction libre, identité,
 * identifiant, correction ni donnée de routage dans un payload externe. */
export function projectExternal(context: Context) {
  return {
    mode: context.mode,
    competence: Object.prototype.hasOwnProperty.call(COMPETENCES, context.competence) ? context.competence : 'inconnue',
    niveau: ['A1', 'A2', 'B1', 'B2'].includes(context.level) ? context.level : 'inconnu',
    type: ['qcm', 'vrai_faux', 'appariement', 'ordre_chronologique'].includes(context.itemType) ? context.itemType : 'autre',
    submitted: context.submitted,
  };
}
export interface PedagogicalResponse {
  text: string; refused: boolean; provider: 'server_context' | 'faq_fallback'; visibleFallback: boolean;
  aiInvoked: false; realAiBlocked: true;
  tool: { name: AssistantTool; allowed: boolean; route?: string } | null;
  enforcement?: 'client_existing';
  externalContext?: ReturnType<typeof projectExternal>;
}
function reply(text: string, refused = false, tool: PedagogicalResponse['tool'] = null): PedagogicalResponse {
  return { text, refused, tool, provider: 'server_context', visibleFallback: false, aiInvoked: false, realAiBlocked: true };
}
export function unavailable(): PedagogicalResponse {
  return { ...reply('Je ne peux pas vérifier le contexte de cet exercice. Demande au formateur de vérifier ton activité.', true), provider: 'faq_fallback', visibleFallback: true };
}
function normalize(text: string) { return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
function intent(body: Row): string {
  const tool = string(object(body.tool).name);
  if (tool) return ASSISTANT_TOOLS.includes(tool as AssistantTool) ? tool : 'unknown';
  const question = normalize(string(body.question).slice(0, 500));
  if (/professeur|formateur|aide humaine/.test(question)) return 'flag_help_needed';
  if (/indice/.test(question)) return 'deliver_validated_hint';
  if (/reecout|replay|ecouter.*nouveau/.test(question)) return 'replay_audio_segment';
  if (/ensuite|prochaine activite/.test(question)) return 'recommend_next_activity';
  if (/pourquoi|fausse|erreur|corrig/.test(question)) return 'explanation';
  if (/competence/.test(question)) return 'competence';
  if (/consigne|dois.je faire|explique|reformul/.test(question)) return 'instruction';
  return 'unknown';
}
function instruction(context: Context): string {
  const method: Record<string, string> = {
    qcm: 'Lis la question. Choisis une réponse parmi les propositions.',
    vrai_faux: 'Lis chaque affirmation. Indique si elle est vraie ou fausse.',
    appariement: 'Relie les éléments qui vont ensemble.',
    ordre_chronologique: 'Replace les éléments dans leur ordre.',
  };
  const steps = method[context.itemType] ?? 'Suis les étapes de la consigne.';
  return `${context.instruction.slice(0, 650)}\nEn pratique : ${steps}${context.objective ? `\nObjectif de la séance : ${context.objective.slice(0, 200)}` : ''}`;
}
// Aucun import de client IA et aucune dépendance modèle dans ce chemin.
export async function handlePedagogical(deps: Dependencies & { body: unknown }): Promise<PedagogicalResponse> {
  const body = object(deps.body);
  try {
    const context = await loadContext(deps, body);
    const action = intent(body);
    const toolName = ASSISTANT_TOOLS.includes(action as AssistantTool) ? action as AssistantTool : null;
    const refuse = (text: string) => reply(text, true, toolName ? { name: toolName, allowed: false } : null);
    let result: PedagogicalResponse;
    switch (action) {
      case 'instruction':
        result = context.instruction ? reply(instruction(context)) : refuse('La consigne validée est indisponible.'); break;
      case 'competence':
        result = COMPETENCES[context.competence] ? reply(`Tu travailles la ${COMPETENCES[context.competence]}.`) : refuse('La compétence de cet exercice est indisponible.'); break;
      case 'explanation':
        result = context.mode !== 'evaluation' && context.submitted && context.correctionReleased && context.justification
          ? reply(`Voici l’explication validée pour cette question : ${context.justification.slice(0, 1800)}`)
          : refuse('L’explication est disponible seulement après remise et libération de la correction, hors évaluation.'); break;
      case 'deliver_validated_hint': {
        // Banque versionnée uniquement. Jamais justification / choices / Gemini.
        const rawLevel = Number(object(object(body.tool).args).level);
        const level = Number.isInteger(rawLevel) && rawLevel >= 1 ? rawLevel : 1;
        const delivered = deliverValidatedHint({
          mode: context.mode,
          exerciseId: context.exerciseId,
          itemId: context.itemId,
          factsHash: context.factsHash,
          sealedItem: {
            exercise_id: context.exerciseId,
            level: context.level as 'A1' | 'A2' | 'B1' | 'B2',
            item_id: context.itemId,
            facts_hash: context.factsHash,
            fact_refs: context.factRefs,
            instruction: context.instruction,
            choices: context.sealedChoices,
            justification: context.sealedJustification,
          },
        }, level);
        result = delivered.allowed
          ? reply(delivered.text, false, { name: action, allowed: true })
          : refuse(delivered.text);
        break;
      }
      case 'replay_audio_segment':
        result = context.mode === 'evaluation' ? refuse('La réécoute supplémentaire est interdite en évaluation.')
          : context.maxListens === null ? refuse('Le contrat d’écoute est indisponible. Utilise les indications du lecteur.')
          : { ...reply(`Le contrat prévoit ${context.maxListens} écoutes au total. Utilise le lecteur de l’exercice : il gère les écoutes. L’assistant ne lance pas l’audio et ne tient pas de compteur serveur.`, false, { name: action, allowed: true }), enforcement: 'client_existing' };
        break;
      case 'recommend_next_activity':
        result = context.mode === 'evaluation' || (context.mode === 'devoir' && !context.submitted) || !context.recommendation
          ? refuse('Aucune prochaine activité autorisée n’est disponible pour le moment.')
          : reply(context.recommendation.text.slice(0, 400) || 'Le parcours te propose de poursuivre avec ce devoir.', false, { name: action, allowed: true, route: context.recommendation.route }); break;
      case 'open_route': {
        const route = string(object(object(body.tool).args).route);
        const allowed = context.mode !== 'evaluation' && ((Boolean(context.devoirId) && route === `/eleve/devoirs/${context.devoirId}`) ||
          (context.mode === 'entrainement' && ['/eleve/ma-seance', '/eleve/devoirs'].includes(route)));
        result = allowed ? reply('Tu peux ouvrir cette activité.', false, { name: action, allowed: true, route }) : refuse('Cette destination n’est pas autorisée dans le contexte actuel.');
        break;
      }
      case 'flag_help_needed': {
        const category = string(body.category) || 'consigne';
        if (!['consigne', 'comprehension', 'technique'].includes(category) || !context.sessionId || (context.mode === 'evaluation' && category !== 'technique')) {
          result = refuse(context.mode === 'evaluation' ? 'Seul un problème technique peut être signalé pendant l’évaluation.' : 'La demande d’aide nécessite une séance et une catégorie vérifiées.'); break;
        }
        // Revalider juste avant l'écriture ; le résumé et les identifiants
        // proviennent du serveur. Ne pas inventer un nombre d'indices utilisés.
        const current = await loadContext(deps, body);
        if (current.sessionId !== context.sessionId || (current.mode === 'evaluation' && category !== 'technique')) return unavailable();
        await deps.userStore.insert('session_live_events', {
          session_id: current.sessionId, eleve_id: current.owner, event_type: 'aide_demandee',
          payload: { exercice_id: current.exerciseId, categorie: category, demande_explicite: true, resume: category === 'technique' ? 'Difficulté technique signalée.' : 'Aide pédagogique demandée.', indices_utilises: null, indices_suivi: 'non_disponible_lot2a' },
        });
        result = reply('Ta demande d’aide a été transmise au formateur.', false, { name: action, allowed: true }); break;
      }
      default:
        result = { ...refuse('Je peux expliquer la consigne, la compétence ou une correction libérée, et transmettre une demande d’aide.'), provider: 'faq_fallback', visibleFallback: true };
    }
    return { ...result, externalContext: projectExternal(context) };
  } catch {
    // Ni erreur SQL ni contenu/correction dans le message ou les logs.
    return unavailable();
  }
}
