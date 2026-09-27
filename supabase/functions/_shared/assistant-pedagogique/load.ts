import { object, one, string, type DataStore, type Row } from './store.ts';
import type { ActivityMode } from '../assistant-accueil/contract-v1.ts';
import { isExerciseLinkVisible, resolveLearnerLevelForCompetence } from '../session-visibility.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SOURCE = '4a0e8321-9ece-42d7-bf76-8825b1e65e79';
const FACTS = 'sha256:4fd8d5565ba8cedeb8fa0d9bbf20451dece02b4c83157f4303433398ba03f5a5';
const PILOT = new Set(['62b06150-7942-4c41-bab9-fdba0a4d852c', '972e14a8-9fe1-4f3d-93d1-9a8280028c91', 'bcbcef25-7dcf-4e35-97dd-1fb641ab9815', 'cb06e39a-e914-4729-8ce4-893e7f8faeaf']);

export interface Context {
  owner: string; exerciseId: string; sessionId: string | null; devoirId: string | null;
  mode: ActivityMode; instruction: string; itemType: string; competence: string;
  objective: string; level: string; submitted: boolean; correctionReleased: boolean;
  justification: string | null; maxListens: number | null;
  recommendation: { text: string; route: string } | null;
}
export interface Dependencies { authUserId: string; userStore: DataStore; contentStore: DataStore }

/** Corps client = sélecteurs uniquement. Aucun statut/mode/texte client lu. */
export async function loadContext(deps: Dependencies, input: Row): Promise<Context> {
  const { authUserId: uid, userStore: user, contentStore: content } = deps;
  const exerciseId = string(input.exerciseId);
  const devoirId = string(input.devoirId) || null;
  let sessionId = string(input.sessionId) || null;
  const attemptId = string(input.attemptId) || null;
  if (!UUID.test(uid) || !PILOT.has(exerciseId) || (!!devoirId === !!sessionId) ||
      (devoirId && !UUID.test(devoirId)) || (sessionId && !UUID.test(sessionId)) || (attemptId && !UUID.test(attemptId)) ||
      !Number.isInteger(input.itemIndex) || Number(input.itemIndex) < 0) throw new Error('invalid_context');

  let mode: ActivityMode;
  let session: Row | null = null;
  let link: Row | null = null;
  let assignmentId: string | null = null;
  if (devoirId) {
    const devoir = await one(user, 'devoirs', 'id, eleve_id, exercice_id, session_id, contexte, statut', { id: devoirId, eleve_id: uid, exercice_id: exerciseId });
    if (!devoir || devoir.eleve_id !== uid || devoir.exercice_id !== exerciseId) throw new Error('not_assigned');
    // La colonne contexte est protégée par le trigger de garde existant.
    if (!['devoir', 'entrainement', 'evaluation', 'seance'].includes(string(devoir.contexte))) throw new Error('mode_unknown');
    mode = devoir.contexte === 'seance' ? 'entrainement' : devoir.contexte as ActivityMode;
    sessionId = string(devoir.session_id) || null;
    const assignment = await one(content, 'exercise_assignments', 'id', { source_devoir_id: devoirId });
    assignmentId = string(assignment?.id) || null;
  } else {
    // Contexte séance explicite, pas le mode en_ligne de l'exercice.
    mode = 'entrainement';
  }
  if (sessionId) {
    session = await one(user, 'sessions', 'id, group_id, titre, objectifs, training_session_id', { id: sessionId });
    if (!session || !string(session.group_id)) throw new Error('session_unavailable');
    const membership = await one(user, 'group_members', 'group_id, eleve_id', { group_id: string(session.group_id), eleve_id: uid });
    if (!membership || membership.eleve_id !== uid) throw new Error('not_enrolled');
    if (!devoirId) {
      const sent = await content.read('session_exercices', 'exercice_id, eleve_id, is_sent, bloc', { session_id: sessionId, exercice_id: exerciseId });
      link = sent.find(row => row.is_sent === true && (row.eleve_id === uid || row.eleve_id === null)) ?? null;
      if (link) {
        if (['evaluation', 'diagnostic', 'test'].includes(string(link.bloc))) mode = 'evaluation';
        else if (!['core', 'retrospective', 'entrainement', 'consolidation', 'remediation'].includes(string(link.bloc))) throw new Error('mode_unknown');
      } else if (string(session.training_session_id)) {
        const training = await one(content, 'training_sessions', 'code', { id: string(session.training_session_id) });
        if (!training) throw new Error('session_unavailable');
        const links = await content.read('session_document_links', 'eleve_id, audience, linked_id', { session_code: string(training.code), linked_id: exerciseId, linked_type: 'exercise' });
        link = links.find(row => ['apprenant', 'both'].includes(string(row.audience)) && (row.eleve_id === null || row.eleve_id === uid)) ?? null;
      }
      if (!link) throw new Error('exercise_not_in_session');
    }
  } else if (!devoirId) throw new Error('session_required');

  // Une épreuve active prime sur le rattachement devoir/séance.
  const evaluations = await user.read('test_sessions', 'id', { apprenant_id: uid, statut: 'en_cours' });
  if (evaluations.length) mode = 'evaluation';

  const exercise = await one(content, 'exercices', 'id, consigne, competence, format, niveau_vise, contenu', { id: exerciseId });
  if (!exercise) throw new Error('exercise_unavailable');
  const data = object(exercise.contenu), meta = object(data.metadata), audio = object(data.audio);
  const family = await one(content, 'differentiation_families', 'source_id, source_content_hash, review_status, payload', { published_exercise_id: exerciseId });
  const source = await one(content, 'pedagogical_sources', 'content_hash, status, review_status', { id: SOURCE });
  if (!family || !source || family.review_status !== 'published' || family.source_id !== SOURCE ||
      meta.source_id !== SOURCE || audio.source_id !== SOURCE || meta.facts_hash !== FACTS ||
      object(object(family.payload).facts).facts_hash !== FACTS || meta.source_stale === true ||
      source.status !== 'analyzed' || !['utilisable', 'valide'].includes(string(source.review_status)) ||
      !/^sha256:[0-9a-f]{64}$/.test(string(source.content_hash)) ||
      ![family.source_content_hash, audio.source_content_hash, meta.source_content_hash].every(hash => hash === source.content_hash)) throw new Error('source_not_validated');
  if (link && session) {
    const profile = await one(user, 'profils_eleves', 'niveau_actuel, niveau_co, niveau_ce, niveau_ee, niveau_eo', { eleve_id: uid });
    const group = await one(user, 'groups', 'niveau', { id: string(session.group_id) });
    const level = resolveLearnerLevelForCompetence(profile, string(group?.niveau), string(exercise.competence));
    if (!isExerciseLinkVisible({ eleve_id: link.eleve_id === null ? null : string(link.eleve_id) }, { niveau_vise: string(exercise.niveau_vise) }, uid, level)) throw new Error('level_not_assigned');
  }
  const items = Array.isArray(data.items) ? data.items : [];
  const item = object(items[Number(input.itemIndex)]);
  if (!Object.keys(item).length) throw new Error('item_unavailable');
  // Le hash de la source ne scelle pas, à lui seul, un corrigé qui aurait été
  // édité après publication. Vérifier l'item contre la variante publiée.
  const validatedExercise = object(object(object(object(family.payload).variants)[string(exercise.niveau_vise)]).exercise);
  const validatedItems = Array.isArray(validatedExercise.items) ? validatedExercise.items : [];
  const matches = validatedItems.map(object).filter(candidate => candidate.id === item.id && string(item.id));
  if (matches.length !== 1) throw new Error('unvalidated_item');
  const validatedItem = matches[0];
  const choices = (value: unknown) => Array.isArray(value) ? value.map(choice => {
    const c = object(choice); return [c.id, c.text, c.is_correct];
  }) : [];
  if (item.instruction !== validatedItem.instruction || item.type !== validatedItem.type ||
      item.justification !== validatedItem.justification ||
      JSON.stringify(choices(item.choices)) !== JSON.stringify(choices(validatedItem.choices))) throw new Error('item_changed_since_validation');
  let attempt: Row | null = null;
  const filters: Record<string, string | null> = { learner_id: uid, exercise_id: exerciseId };
  if (devoirId && assignmentId) filters.assignment_id = assignmentId;
  else if (!devoirId) filters.session_id = sessionId;
  // Pas de résolution globale élève/exercice : contexte ambigu => pas de correction.
  if (!devoirId || assignmentId) {
    if (attemptId) filters.id = attemptId;
    attempt = (await user.read('exercise_attempts', 'id, learner_id, exercise_id, assignment_id, session_id, status, completed_at, correction_released_at', filters, !attemptId))[0] ?? null;
  }
  if (attemptId && !attempt) throw new Error('attempt_not_authorized');
  const submitted = attempt?.status === 'completed' && Boolean(attempt.completed_at);
  const correctionReleased = submitted && Boolean(attempt?.correction_released_at) && mode !== 'evaluation';
  const max = object(object(meta.level_contract).audio_policy).max_listens;
  let recommendation: Context['recommendation'] = null;
  if (mode !== 'evaluation' && (mode !== 'devoir' || submitted)) {
    const routingFilters: Record<string, string | null> = { eleve_id: uid, exercice_id: exerciseId, session_id: sessionId };
    const route = (await user.read('routing_decisions', 'reason_student, devoir_genere', routingFilters, true))[0];
    if (route && UUID.test(string(route.devoir_genere))) {
      const next = await one(user, 'devoirs', 'id', { id: string(route.devoir_genere), eleve_id: uid });
      if (next) recommendation = { text: string(route.reason_student), route: `/eleve/devoirs/${string(next.id)}` };
    }
  }
  return {
    owner: uid, exerciseId, devoirId, sessionId, mode,
    instruction: string(validatedItem.instruction) || string(validatedExercise.instruction), itemType: string(validatedItem.type) || string(exercise.format),
    competence: string(exercise.competence), level: string(exercise.niveau_vise), objective: string(session?.objectifs),
    submitted, correctionReleased, justification: correctionReleased ? string(validatedItem.justification) || null : null,
    maxListens: Number.isInteger(max) && Number(max) > 0 ? Number(max) : null, recommendation,
  };
}
