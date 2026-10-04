/**
 * Orchestrateur unique d'accueil.
 * auth.uid et le contrôle d'appartenance restent ici.
 * Le payload sortant est pseudonymisé : pas de nom, d'email, ni d'uid.
 * Aucun appel réseau. Le modèle n'est pas invoqué dans ce lot.
 */
import {
  ASSISTANT_TOOLS,
  CONTRACT_VERSION,
  MODE_TOOL_MATRIX,
  RETENTION_POLICY,
  type ActivityMode,
  type AssistantTool,
} from "./contract-v1.ts";

export type { ActivityMode, AssistantTool } from "./contract-v1.ts";

export type ServerSnapshot = {
  ownerUserId: string;
  email: string | null;
  nom: string | null;
  prenom: string | null;
  mode: ActivityMode;
  modeProven: boolean;
  niveau: "A1" | "A2" | "B1" | "B2";
  currentDevoirId: string | null;
  devoirSubmitted: boolean;
  devoirReplayAllowed: boolean;
  evaluationRoute: string | null;
  exerciceReplayAllowed: boolean;
  sessionCodes: string[];
  validatedHints: string[];
  correction: string | null;
  answerKey: string | null;
  transcript: string | null;
  devoirs: {
    id: string;
    titre: string;
    statut: "en_attente" | "fait" | "expire" | "arrete";
    eleveId: string;
  }[];
  prochaineSeance: { code: string; titre: string; date: string } | null;
  activiteCourante: { titre: string; route: string } | null;
  qcm: { options: string[]; correctIndex: number } | null;
};

export type RlsRows = {
  devoirs: {
    id: string;
    eleve_id: string;
    statut: string;
    titre?: string;
  }[];
  sessions: { titre?: string; date_seance?: string; code?: string }[];
  evaluations: { id: string; apprenant_id: string; statut: string }[];
  trustedRls?: boolean;
  requestedPath?: string | null;
};

export type GeminiPayload = {
  contract_version: typeof CONTRACT_VERSION;
  mode: ActivityMode;
  niveau: string;
  allowed_tools: AssistantTool[];
  question: string;
  navigation: {
    devoirs_ouverts: number;
    devoir_titre: string | null;
    prochaine_seance: string | null;
    activite_titre: string | null;
  };
  hints: string[];
  replay: "allowed" | "denied";
};

export type PublicAccueilResponse = {
  text: string;
  provider: "faq_fallback" | "server_context";
  visibleFallback: boolean;
  contractVersion: typeof CONTRACT_VERSION;
};

export type AccueilJournal = {
  provider: "faq_fallback" | "server_context";
  store_text: false;
  metric: "accueil_turn";
};

export type ToolDecision = {
  name: AssistantTool;
  allowed: boolean;
  route?: string;
  reason?: string;
};

export type AccueilResult = {
  aiCalled: boolean;
  allowModelCall: boolean;
  refused: boolean;
  reason: string | null;
  geminiPayload: GeminiPayload | null;
  tool: ToolDecision | null;
  publicResponse: PublicAccueilResponse;
  journal: AccueilJournal;
  retention: null | {
    kind: "flag_help_needed" | "error";
    days: number;
    excerpt?: string;
    summary?: string;
    redacted?: string;
  };
};

const TRAINING_EXACT = new Set([
  "/eleve",
  "/eleve/ma-seance",
  "/eleve/mes-seances",
  "/eleve/devoirs",
  "/eleve/carnet",
  "/eleve/progression",
  "/eleve/profil",
  "/eleve/acces-limite",
  "/eleve/test-positionnement",
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SESSION_CODE_RE = /^[A-Z][A-Z0-9]{1,6}$/;
const EVAL_ROUTE_RE =
  /^\/eleve\/(?:test-positionnement\/passer\/[A-Za-z0-9_-]{6,80}|bilan-test\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

const QCM_STOP = new Set([
  "relis",
  "verbe",
  "consigne",
  "pense",
  "texte",
  "phrase",
  "question",
  "reponse",
  "bonne",
  "indice",
  "regarde",
  "compare",
  "idees",
  "choisir",
  "place",
  "sans",
  "cette",
  "classe",
  "lecon",
  "seance",
  "devoir",
  "activite",
]);

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isAccueilQuestion(question: string): boolean {
  return welcomeKind(question) !== null;
}

function welcomeKind(question: string): "today" | "devoirs" | "seance" | "activity" | null {
  const n = normalize(question);
  if (n.includes("aujourd")) return "today";
  if (n.includes("prochaine") && n.includes("seance")) return "seance";
  if (n.includes("ouvre") && n.includes("activite")) return "activity";
  if (n.includes("devoir")) return "devoirs";
  return null;
}

export function modeFromStudentPath(path: string | null | undefined): ActivityMode {
  const value = path ?? "";
  // Passation active seulement — les bilans post-test restent en orientation (entrainement).
  if (/\/test-positionnement\/passer\//.test(value)) {
    return "evaluation";
  }
  if (/\/devoirs\/[^/]+/.test(value)) return "devoir";
  return "entrainement";
}

function ownsSnapshot(authUserId: string, snapshot: ServerSnapshot): boolean {
  if (!authUserId || snapshot.ownerUserId !== authUserId) return false;
  return snapshot.devoirs.every((devoir) => devoir.eleveId === authUserId);
}

function secretsOf(authUserId: string, snapshot: ServerSnapshot): string[] {
  return [authUserId, snapshot.ownerUserId, snapshot.email, snapshot.nom, snapshot.prenom]
    .filter((value): value is string => Boolean(value && value.trim()));
}

function redactIdentifiers(text: string, secrets: string[]): string {
  let out = text;
  const ordered = [...secrets].sort((a, b) => b.length - a.length);
  for (const secret of ordered) {
    if (secret.length < 3) continue;
    out = out.split(secret).join("[masque]");
  }
  out = out.replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, "[masque]");
  out = out.replace(
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
    "[masque]",
  );
  return out;
}

function pendingDevoirs(snapshot: ServerSnapshot) {
  return snapshot.devoirs.filter((devoir) => devoir.statut === "en_attente" && devoir.eleveId === snapshot.ownerUserId);
}

function allowedTools(snapshot: ServerSnapshot): AssistantTool[] {
  const mode = snapshot.mode;
  const tools: AssistantTool[] = [];
  for (const tool of ASSISTANT_TOOLS) {
    if (toolAllowed(snapshot, tool)) tools.push(tool);
  }
  if (mode === "evaluation") {
    return tools.filter((tool) => tool === "open_route" || tool === "flag_help_needed");
  }
  return tools;
}

function toolAllowed(snapshot: ServerSnapshot, tool: AssistantTool): boolean {
  const rule = MODE_TOOL_MATRIX[snapshot.mode][tool];
  if ("allowed" in rule && rule.allowed === false) return false;
  if (!snapshot.modeProven && tool !== "open_route" && tool !== "flag_help_needed") return false;
  if (tool === "replay_audio_segment") {
    if (snapshot.mode === "evaluation") return false;
    if (snapshot.mode === "devoir") return snapshot.devoirReplayAllowed;
    return snapshot.exerciceReplayAllowed;
  }
  if (tool === "recommend_next_activity") {
    if (snapshot.mode === "evaluation") return false;
    if (snapshot.mode === "devoir") return snapshot.devoirSubmitted;
    return true;
  }
  if (tool === "deliver_validated_hint") return snapshot.mode !== "evaluation";
  return true;
}

function isSafePath(route: string): boolean {
  if (!route.startsWith("/eleve")) return false;
  if (route.length > 120) return false;
  if (route.includes("..") || route.includes("\\") || route.includes("//")) return false;
  if (/[?#\s]/.test(route)) return false;
  return true;
}

export function routeAllowed(snapshot: ServerSnapshot, route: string): boolean {
  if (!isSafePath(route)) return false;
  if (snapshot.mode === "evaluation") {
    return Boolean(
      snapshot.evaluationRoute &&
        route === snapshot.evaluationRoute &&
        EVAL_ROUTE_RE.test(route),
    );
  }
  if (snapshot.mode === "devoir") {
    if (!snapshot.currentDevoirId || !UUID_RE.test(snapshot.currentDevoirId)) return false;
    const owned = snapshot.devoirs.some(
      (devoir) => devoir.id === snapshot.currentDevoirId && devoir.eleveId === snapshot.ownerUserId,
    );
    return owned && route === `/eleve/devoirs/${snapshot.currentDevoirId}`;
  }
  if (TRAINING_EXACT.has(route)) return true;
  const devoirMatch = /^\/eleve\/devoirs\/([^/]+)$/.exec(route);
  if (devoirMatch) {
    const id = devoirMatch[1];
    return snapshot.devoirs.some((devoir) => devoir.id === id && devoir.eleveId === snapshot.ownerUserId);
  }
  const sessionMatch = /^\/eleve\/seances\/([^/]+)$/.exec(route);
  if (sessionMatch) {
    const code = sessionMatch[1];
    return SESSION_CODE_RE.test(code) && snapshot.sessionCodes.includes(code);
  }
  return false;
}

function qcmViolation(hint: string, qcm: NonNullable<ServerSnapshot["qcm"]>): string | null {
  const n = normalize(hint);
  if (
    /pas\s+(la\s+)?(option\s+)?[abcd]/.test(n) ||
    /elimine|ecarte/.test(n) ||
    /option\s+[abcd]\s+est\s+fausse/.test(n)
  ) {
    return "elimine_option";
  }
  if (
    /choisis|coche/.test(n) ||
    /probablement\s+[abcd]/.test(n) ||
    /la\s+bonne\s+est/.test(n) ||
    /option\s+[abcd]/.test(n)
  ) {
    return "designe_option";
  }
  if (/entre\s+[abcd]\s+et\s+[abcd]/.test(n) || /seulement\s+[abcd]\s+ou\s+[abcd]/.test(n)) {
    return "reduit_a_deux";
  }
  const correct = normalize(qcm.options[qcm.correctIndex] ?? "");
  const others = qcm.options
    .filter((_, index) => index !== qcm.correctIndex)
    .map((option) => normalize(option))
    .join(" ");
  for (const word of n.split(" ")) {
    if (word.length < 5 || QCM_STOP.has(word)) continue;
    if (correct.includes(word) && !others.includes(word)) return "mot_reponse";
  }
  return null;
}

function maxHintLevel(mode: ActivityMode): number {
  if (mode === "devoir") return MODE_TOOL_MATRIX.devoir.deliver_validated_hint.maxLevel;
  if (mode === "entrainement") return MODE_TOOL_MATRIX.entrainement.deliver_validated_hint.maxLevel;
  return 0;
}

export function buildGeminiPayload(
  authUserId: string,
  snapshot: ServerSnapshot,
  question = "",
): GeminiPayload | null {
  if (!ownsSnapshot(authUserId, snapshot)) return null;
  const hints =
    snapshot.mode === "evaluation"
      ? []
      : snapshot.validatedHints.slice(0, maxHintLevel(snapshot.mode));
  return {
    contract_version: CONTRACT_VERSION,
    mode: snapshot.mode,
    niveau: snapshot.niveau,
    allowed_tools: allowedTools(snapshot),
    question: redactIdentifiers(question, secretsOf(authUserId, snapshot)),
    navigation: {
      devoirs_ouverts: pendingDevoirs(snapshot).length,
      devoir_titre: pendingDevoirs(snapshot)[0]?.titre ?? null,
      prochaine_seance: snapshot.prochaineSeance?.titre ?? null,
      activite_titre: snapshot.activiteCourante?.titre ?? null,
    },
    hints,
    replay: toolAllowed(snapshot, "replay_audio_segment") ? "allowed" : "denied",
  };
}

function metricJournal(provider: AccueilJournal["provider"]): AccueilJournal {
  return { provider, store_text: false, metric: "accueil_turn" };
}

function respond(
  partial: Omit<AccueilResult, "aiCalled" | "allowModelCall" | "journal" | "retention"> & {
    journal?: AccueilJournal;
    retention?: AccueilResult["retention"];
  },
): AccueilResult {
  return {
    aiCalled: false,
    allowModelCall: false,
    retention: partial.retention ?? null,
    journal: partial.journal ?? metricJournal(partial.publicResponse.provider),
    refused: partial.refused,
    reason: partial.reason,
    geminiPayload: partial.geminiPayload,
    tool: partial.tool,
    publicResponse: partial.publicResponse,
  };
}

function publicText(text: string, provider: PublicAccueilResponse["provider"], visibleFallback = false): PublicAccueilResponse {
  return {
    text,
    provider,
    visibleFallback,
    contractVersion: CONTRACT_VERSION,
  };
}

function refuseOtherStudent(): AccueilResult {
  return respond({
    refused: true,
    reason: "other_student",
    geminiPayload: null,
    tool: null,
    publicResponse: publicText(
      "Je ne peux pas répondre avec les données d'un autre élève.",
      "server_context",
    ),
  });
}

function decideOpenRoute(snapshot: ServerSnapshot, route: string): { decision: ToolDecision; text: string } {
  const allowed = routeAllowed(snapshot, route);
  if (!allowed) {
    return {
      decision: { name: "open_route", allowed: false, reason: "route_refusee" },
      text: "Cette page n'est pas autorisée ici.",
    };
  }
  return {
    decision: { name: "open_route", allowed: true, route },
    text: `J'ouvre ${route}.`,
  };
}

function decideHint(snapshot: ServerSnapshot, level: number): { decision: ToolDecision; text: string } {
  if (!toolAllowed(snapshot, "deliver_validated_hint") || snapshot.mode === "evaluation") {
    return {
      decision: { name: "deliver_validated_hint", allowed: false, reason: "indice_interdit" },
      text: "Je ne donne pas d'indice pendant une évaluation.",
    };
  }
  const max = maxHintLevel(snapshot.mode);
  if (!Number.isInteger(level) || level < 1 || level > max) {
    return {
      decision: { name: "deliver_validated_hint", allowed: false, reason: "niveau_indice" },
      text: snapshot.mode === "devoir"
        ? "En devoir, seul l'indice 1 est disponible."
        : "Cet indice n'est pas disponible.",
    };
  }
  const hint = snapshot.validatedHints[level - 1];
  if (!hint) {
    return {
      decision: { name: "deliver_validated_hint", allowed: false, reason: "banque_vide" },
      text: "Aucun indice validé n'est disponible.",
    };
  }
  if (snapshot.qcm) {
    const violation = qcmViolation(hint, snapshot.qcm);
    if (violation) {
      return {
        decision: { name: "deliver_validated_hint", allowed: false, reason: violation },
        text: "Cet indice validé n'est pas utilisable pour un QCM.",
      };
    }
  }
  return {
    decision: { name: "deliver_validated_hint", allowed: true },
    text: hint,
  };
}

function decideTool(
  snapshot: ServerSnapshot,
  requested: { name: AssistantTool; args: Record<string, unknown> },
): { decision: ToolDecision; text: string; retention?: AccueilResult["retention"] } {
  if (!ASSISTANT_TOOLS.includes(requested.name)) {
    return {
      decision: { name: "open_route", allowed: false, reason: "outil_inconnu" },
      text: "Cet outil n'existe pas.",
    };
  }
  const args = requested.args ?? {};
  if (requested.name === "open_route") {
    const route = typeof args.route === "string" ? args.route : "";
    return decideOpenRoute(snapshot, route);
  }
  if (requested.name === "deliver_validated_hint") {
    const level = Number(args.level);
    return decideHint(snapshot, level);
  }
  if (requested.name === "replay_audio_segment") {
    const allowed = toolAllowed(snapshot, "replay_audio_segment");
    return {
      decision: { name: "replay_audio_segment", allowed, reason: allowed ? undefined : "replay_refuse" },
      text: allowed
        ? "Je peux rejouer le passage prévu par l'exercice."
        : "Je ne peux pas rejouer l'audio dans cette situation.",
    };
  }
  if (requested.name === "recommend_next_activity") {
    const allowed = toolAllowed(snapshot, "recommend_next_activity");
    const next = snapshot.prochaineSeance?.titre ?? pendingDevoirs(snapshot)[0]?.titre ?? null;
    return {
      decision: { name: "recommend_next_activity", allowed, reason: allowed ? undefined : "recommandation_refusee" },
      text: allowed && next
        ? `Prochaine activité : ${next}.`
        : "Je ne propose pas d'activité suivante pour le moment.",
    };
  }
  const kind = args.kind === "technique" ? "technique" : "pedagogique";
  if (snapshot.mode === "evaluation" && kind !== "technique") {
    return {
      decision: { name: "flag_help_needed", allowed: false, reason: "aide_pedagogique_interdite" },
      text: "Pendant l'évaluation, je ne transmets qu'un signal technique.",
    };
  }
  const raw = typeof args.note === "string" ? args.note : "Demande d'aide";
  const excerpt = redactIdentifiers(raw, secretsOf(snapshot.ownerUserId, snapshot)).slice(0, 180);
  return {
    decision: { name: "flag_help_needed", allowed: true },
    text: snapshot.mode === "evaluation"
      ? "J'ai noté un signal technique pour le formateur."
      : "J'ai noté un signal d'aide pour le formateur.",
    retention: {
      kind: "flag_help_needed",
      days: RETENTION_POLICY.flag_help_needed.days,
      excerpt,
      summary: snapshot.mode === "evaluation" ? "Signal technique" : "Signal d'aide pédagogique",
    },
  };
}

function welcomeAnswer(snapshot: ServerSnapshot, question: string): { text: string; route: string | null } {
  const kind = welcomeKind(question);
  if (kind === "today") {
    const pending = pendingDevoirs(snapshot);
    const seance = snapshot.prochaineSeance?.titre;
    const route = routeAllowed(snapshot, "/eleve/devoirs")
      ? "/eleve/devoirs"
      : routeAllowed(snapshot, "/eleve/ma-seance")
        ? "/eleve/ma-seance"
        : null;
    if (snapshot.mode === "evaluation") {
      return {
        text: "Pendant l'évaluation, je reste sur l'écran d'évaluation.",
        route: snapshot.evaluationRoute && routeAllowed(snapshot, snapshot.evaluationRoute)
          ? snapshot.evaluationRoute
          : null,
      };
    }
    if (pending.length > 0) {
      return {
        text: `Aujourd'hui, commence par le devoir ${pending[0].titre}.${seance ? ` Ensuite, la séance ${seance}.` : ""}`,
        route,
      };
    }
    if (seance) {
      return { text: `Aujourd'hui, ta prochaine séance est ${seance}.`, route: "/eleve/ma-seance" };
    }
    return { text: "Aujourd'hui, ouvre Ma séance pour voir le travail prévu.", route: "/eleve/ma-seance" };
  }
  if (kind === "devoirs") {
    if (snapshot.mode === "evaluation") {
      return { text: "Pendant l'évaluation, je n'ouvre pas les devoirs.", route: null };
    }
    if (snapshot.mode === "devoir" && snapshot.currentDevoirId) {
      const route = `/eleve/devoirs/${snapshot.currentDevoirId}`;
      return {
        text: "Tu es déjà dans ton devoir.",
        route: routeAllowed(snapshot, route) ? route : null,
      };
    }
    const count = pendingDevoirs(snapshot).length;
    return {
      text: count > 0
        ? `Tes devoirs sont sur la page Mes devoirs. ${count} devoir en attente.`
        : "Tes devoirs sont sur la page Mes devoirs.",
      route: "/eleve/devoirs",
    };
  }
  if (kind === "seance") {
    if (snapshot.mode === "evaluation") {
      return { text: "Pendant l'évaluation, je n'ouvre pas une autre séance.", route: null };
    }
    const titre = snapshot.prochaineSeance?.titre;
    return {
      text: titre ? `Ta prochaine séance : ${titre}.` : "Ouvre Ma séance pour voir la prochaine séance.",
      route: routeAllowed(snapshot, "/eleve/ma-seance") ? "/eleve/ma-seance" : null,
    };
  }
  const route = snapshot.activiteCourante?.route ?? "";
  if (route && routeAllowed(snapshot, route)) {
    return { text: `J'ouvre l'activité ${snapshot.activiteCourante?.titre ?? ""}.`.trim(), route };
  }
  return { text: "Je ne peux pas ouvrir cette activité depuis cet écran.", route: null };
}

export function buildErrorRetention(payload: unknown, secrets: string[] = []): AccueilResult["retention"] {
  const redacted = redactIdentifiers(JSON.stringify(payload ?? {}), secrets)
    .replace(/CORRECTION_SENTINELLE_EVAL/g, "[masque]")
    .replace(/CLE_REPONSE_SENTINELLE/g, "[masque]")
    .replace(/TRANSCRIPTION_REVELATRICE_AUDIO/g, "[masque]");
  return {
    kind: "error",
    days: RETENTION_POLICY.error.days,
    redacted: redacted.slice(0, 500),
  };
}

export function orchestrateAccueil(input: {
  authUserId: string;
  snapshot: ServerSnapshot;
  question: string;
  requestedTool?: { name: AssistantTool; args: Record<string, unknown> };
  realAiAllowed: boolean;
  invokeModel?: (payload: GeminiPayload) => { text: string };
}): AccueilResult {
  if (!ownsSnapshot(input.authUserId, input.snapshot)) return refuseOtherStudent();

  const payload = buildGeminiPayload(input.authUserId, input.snapshot, input.question);

  if (input.requestedTool) {
    const decided = decideTool(input.snapshot, input.requestedTool);
    return respond({
      refused: !decided.decision.allowed,
      reason: decided.decision.allowed ? null : decided.decision.reason ?? "outil_refuse",
      geminiPayload: payload,
      tool: decided.decision,
      publicResponse: publicText(decided.text, "server_context"),
      retention: decided.retention,
    });
  }

  if (isAccueilQuestion(input.question)) {
    const welcome = welcomeAnswer(input.snapshot, input.question);
    const opened = welcome.route ? decideOpenRoute(input.snapshot, welcome.route) : null;
    return respond({
      refused: false,
      reason: null,
      geminiPayload: payload,
      tool: opened?.decision ?? null,
      publicResponse: publicText(welcome.text, "server_context"),
    });
  }

  // Lot 1 : pas d'appel modèle. realAiAllowed est ignoré tant que le palier payant
  // n'est pas prouvé par l'appelant. Le payload filtré existe, le modèle n'est pas appelé.
  void input.realAiAllowed;
  void input.invokeModel;
  return respond({
    refused: false,
    reason: null,
    geminiPayload: payload,
    tool: null,
    journal: metricJournal("faq_fallback"),
    publicResponse: publicText(
      "Je ne suis pas sûr. Reformule avec des mots simples : devoirs, séance ou activité. FAQ locale.",
      "faq_fallback",
      true,
    ),
  });
}

function asDevoirStatut(value: string): ServerSnapshot["devoirs"][number]["statut"] | null {
  if (value === "en_attente" || value === "fait" || value === "expire" || value === "arrete") return value;
  return null;
}

export function assembleSnapshotFromRlsRows(
  authUserId: string,
  rows: RlsRows,
): { ok: true; snapshot: ServerSnapshot } | { ok: false; reason: "other_student" } {
  if (rows.devoirs.some((devoir) => devoir.eleve_id !== authUserId)) {
    return { ok: false, reason: "other_student" };
  }
  if (rows.evaluations.some((row) => row.apprenant_id !== authUserId)) {
    return { ok: false, reason: "other_student" };
  }

  const devoirs = rows.devoirs.flatMap((devoir) => {
    const statut = asDevoirStatut(devoir.statut);
    if (!statut) return [];
    return [{
      id: devoir.id,
      titre: devoir.titre?.trim() || "Devoir",
      statut,
      eleveId: devoir.eleve_id,
    }];
  });

  const evaluationActive = rows.evaluations.some((row) => row.statut === "en_cours");
  const path = rows.requestedPath ?? "";
  const devoirPath = /^\/eleve\/devoirs\/([0-9a-f-]{36})$/i.exec(path);
  const devoirFromPath = devoirPath && devoirs.some((devoir) => devoir.id === devoirPath[1])
    ? devoirPath[1]
    : null;

  let mode: ActivityMode = "entrainement";
  if (evaluationActive) mode = "evaluation";
  else if (devoirFromPath) mode = "devoir";

  const sessions = rows.trustedRls ? rows.sessions : [];
  const next = sessions.find((session) => session.titre?.trim());
  const sessionCodes = sessions
    .map((session) => session.code?.trim() ?? "")
    .filter((code) => SESSION_CODE_RE.test(code));
  const evaluationRoute = mode === "evaluation" && EVAL_ROUTE_RE.test(path) ? path : null;
  const current = devoirs.find((devoir) => devoir.id === (devoirFromPath ?? devoirs.find((item) => item.statut === "en_attente")?.id));

  const snapshot: ServerSnapshot = {
    ownerUserId: authUserId,
    email: null,
    nom: null,
    prenom: null,
    mode,
    modeProven: true,
    niveau: "A2",
    currentDevoirId: mode === "devoir" ? devoirFromPath : current?.id ?? null,
    devoirSubmitted: current?.statut === "fait" || current?.statut === "arrete",
    devoirReplayAllowed: false,
    evaluationRoute,
    exerciceReplayAllowed: false,
    sessionCodes,
    validatedHints: [],
    correction: null,
    answerKey: null,
    transcript: null,
    devoirs,
    prochaineSeance: next?.titre
      ? { code: sessionCodes[0] ?? "", titre: next.titre, date: next.date_seance ?? "" }
      : null,
    activiteCourante: null,
    qcm: null,
  };
  return { ok: true, snapshot };
}

export function navigationSnapshotFromPage(input: {
  authUserId: string;
  mode: ActivityMode;
  niveau: ServerSnapshot["niveau"];
  sessionCode: string | null;
  sessionTitre: string | null;
  activityTitle: string | null;
  activityRoute: string | null;
  evaluationRoute: string | null;
  pagePath?: string | null;
  devoirs: ServerSnapshot["devoirs"];
}): ServerSnapshot {
  const ownDevoirs = input.devoirs.filter((devoir) => devoir.eleveId === input.authUserId);
  const pathDevoir = input.pagePath?.match(/\/devoirs\/([0-9a-f-]{36})/i)?.[1] ?? null;
  const current = ownDevoirs.find((devoir) => devoir.id === pathDevoir)
    ?? ownDevoirs.find((devoir) => devoir.statut === "en_attente")
    ?? null;
  const sessionCode = input.sessionCode && SESSION_CODE_RE.test(input.sessionCode) ? input.sessionCode : null;
  return {
    ownerUserId: input.authUserId,
    email: null,
    nom: null,
    prenom: null,
    mode: input.mode,
    modeProven: true,
    niveau: input.niveau,
    currentDevoirId: input.mode === "devoir" ? current?.id ?? null : current?.id ?? null,
    devoirSubmitted: false,
    devoirReplayAllowed: false,
    evaluationRoute: input.mode === "evaluation" ? input.evaluationRoute : null,
    exerciceReplayAllowed: false,
    sessionCodes: sessionCode ? [sessionCode] : [],
    validatedHints: [],
    correction: null,
    answerKey: null,
    transcript: null,
    devoirs: ownDevoirs,
    prochaineSeance: input.sessionTitre
      ? { code: sessionCode ?? "", titre: input.sessionTitre, date: "" }
      : null,
    activiteCourante: input.activityTitle && input.activityRoute
      ? { titre: input.activityTitle, route: input.activityRoute }
      : null,
    qcm: null,
  };
}
