import s01Sources from "@/data/captcf-s01-assistant-sources.json";
import type {
  AidePedagogiqueContext,
  PedagogicalIntent,
  PedagogicalLevel,
  PreparedAssistantRequest,
} from "./pedagogicalTypes";
import { isPedagogicalLevel } from "./detectPedagogicalIntent";

/** Clés PII / sensibles interdites dans toute requête préparée. */
export const FORBIDDEN_REQUEST_KEYS = [
  "eleve_id",
  "user_id",
  "email",
  "prenom",
  "nom",
  "telephone",
  "phone",
  "adresse",
  "score",
  "note",
  "resultat",
  "password",
  "token",
  "auth",
] as const;

type Variant = (typeof s01Sources.variantes)[number];

function pickVariant(niveau: PedagogicalLevel): Variant {
  return (
    s01Sources.variantes.find((v) => v.niveau === niveau) ??
    s01Sources.variantes.find((v) => v.niveau === "A2") ??
    s01Sources.variantes[0]
  );
}

function collectStringLeaves(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") {
    out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStringLeaves(item, out);
    return out;
  }
  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      if ((FORBIDDEN_REQUEST_KEYS as readonly string[]).includes(key.toLowerCase())) {
        throw new Error(`PII key forbidden in prepared request: ${key}`);
      }
      collectStringLeaves(nested, out);
    }
  }
  return out;
}

/**
 * Vérifie qu’aucun identifiant / PII n’apparaît dans la payload sérialisée.
 */
export function assertNoPersonalData(request: PreparedAssistantRequest): void {
  const json = JSON.stringify(request);
  const lowered = json.toLowerCase();
  for (const key of FORBIDDEN_REQUEST_KEYS) {
    // Clés JSON explicites
    if (lowered.includes(`"${key}"`)) {
      throw new Error(`Prepared request contains forbidden key: ${key}`);
    }
  }
  // Patterns de courriel / UUID typiques
  if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(json)) {
    throw new Error("Prepared request contains email-like PII");
  }
  collectStringLeaves(request);
}

export function hasPilotSources(sessionCode: string | null | undefined): boolean {
  return sessionCode === s01Sources.session_code;
}

/**
 * Prépare une requête pédagogique sans PII, corpus S01 uniquement.
 * Retourne null si sources insuffisantes (hors pilote).
 */
export function prepareAssistantRequest(params: {
  question: string;
  intent: PedagogicalIntent;
  context: AidePedagogiqueContext;
  providerMode?: PreparedAssistantRequest["meta"]["provider_mode"];
}): PreparedAssistantRequest | null {
  const sessionCode = params.context.sessionCode;
  if (!hasPilotSources(sessionCode)) return null;

  const niveau: PedagogicalLevel = isPedagogicalLevel(params.context.niveau)
    ? params.context.niveau
    : "A2";
  const variant = pickVariant(niveau);
  const objectifs =
    params.context.objectif && params.context.objectif.trim()
      ? [params.context.objectif.trim(), ...s01Sources.objectifs.filter((o) => o !== params.context.objectif)]
      : [...s01Sources.objectifs];

  const request: PreparedAssistantRequest = {
    question: params.question.trim(),
    intent: params.intent,
    niveau,
    session: {
      code: s01Sources.session_code,
      titre: params.context.sessionTitre?.trim() || s01Sources.titre,
      objectifs: objectifs.slice(0, 4),
    },
    lecon: {
      titre: params.context.leconTitre?.trim() || s01Sources.lecon_defaut,
    },
    exercice: params.context.exerciceTitre
      ? {
          titre: params.context.exerciceTitre,
          consigne: params.context.exerciceConsigne || variant.consigne,
          competence: params.context.exerciceCompetence,
        }
      : {
          titre: `Exercice S01 · ${niveau}`,
          consigne: variant.consigne,
          competence: "CO",
        },
    sources: {
      faits: [...s01Sources.faits_valides],
      lexique: s01Sources.lexique.map((m) => ({
        mot: m.mot,
        definition_simple: m.definition_simple,
        exemple: m.exemple,
      })),
      aides: [...variant.aides],
      mini_exercice:
        s01Sources.mini_exercices[niveau as keyof typeof s01Sources.mini_exercices] ?? null,
    },
    meta: {
      provider_mode: params.providerMode ?? "local_deterministic",
      corpus_version: s01Sources.version,
    },
  };

  assertNoPersonalData(request);
  return request;
}

export function getPilotDisclaimer(): string {
  return s01Sources.disclaimer;
}
