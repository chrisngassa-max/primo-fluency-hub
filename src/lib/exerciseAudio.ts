import { supabase } from "@/integrations/supabase/client";

/**
 * Résolution client de l'audio original d'un exercice CO publié.
 *
 * Le résolveur serveur (`resolve-exercise-audio`) renvoie des statuts HTTP
 * discriminés : 200 (resolved), 404 (no_original_audio), 410 (stale),
 * 403 (forbidden), 503 (unavailable). Comme `supabase.functions.invoke()`
 * traite les réponses non-2xx comme des erreurs, on décode ici le corps de
 * la `FunctionsHttpError` (exposé via `error.context`) pour reconstruire le
 * statut discriminé — on ne transforme JAMAIS une réponse non-2xx en une
 * erreur générique.
 */

export type AudioResolution =
  | { status: "resolved"; url: string; expiresAt: string }
  | { status: "no_original_audio" }
  | { status: "stale" }
  | { status: "unavailable"; code?: string }
  | { status: "forbidden"; code?: string };

export interface ResolveExerciseAudioInput {
  exerciseId: string;
  /** Exactement un contexte d'autorisation. */
  sessionCode?: string;
  devoirId?: string;
  playToken?: string;
  preview?: boolean;
}

export interface ResolveExerciseAudioOptions {
  /** Ignore et remplace uniquement l'entrée de cache de ce contexte. */
  forceRefresh?: boolean;
}

/**
 * Décode une erreur d'invoke en statut discriminé. Lit `error.context`
 * (Response) puis le statut HTTP + le champ `status`/`code` du corps JSON.
 */
async function classifyInvokeError(error: unknown): Promise<AudioResolution> {
  const ctx = (error as { context?: Response } | null)?.context;
  if (ctx instanceof Response) {
    const status = ctx.status;
    let body: any = null;
    try {
      body = await ctx.clone().json();
    } catch {
      // Corps illisible.
    }
    const serverStatus = body?.status as string | undefined;
    const code = body?.code as string | undefined;
    if (status === 404 || serverStatus === "no_original_audio") return { status: "no_original_audio" };
    if (status === 410 || serverStatus === "stale") return { status: "stale" };
    if (status === 403) return { status: "forbidden", code };
    if (status === 503 || serverStatus === "unavailable") return { status: "unavailable", code };
  }
  // Fallback défensif : erreur réseau ou forme inattendue.
  return { status: "unavailable" };
}

// --- Cache mémoire contextuel ------------------------------------------
// Une URL signée est un jeton d'accès : la clé de cache doit intégrer
// l'utilisateur + l'exercice + le type + l'identifiant du contexte. Le cache
// est strictement en mémoire (jamais localStorage) et vidé à la déconnexion
// ou au changement d'utilisateur.

interface CacheEntry {
  url: string;
  expiresAt: number; // epoch ms
}
const CACHE_TTL_MS = 8 * 60 * 1000; // 8 min (< TTL serveur 10 min)
const cache = new Map<string, CacheEntry>();

function currentUserId(): string {
  // Le user est conservé par le client Supabase (persistSession). On l'utilise
  // pour Composer la clé ; à défaut, on utilise "public" (mode play_token).
  try {
    const raw = localStorage.getItem("sb-gudcenhmzlcvhgbgklzw-auth-token");
    if (!raw) return "public";
    const parsed = JSON.parse(raw);
    const uid = parsed?.user?.id ?? parsed?.user_id;
    return typeof uid === "string" ? uid : "public";
  } catch {
    return "public";
  }
}

function cacheKey(input: ResolveExerciseAudioInput): string {
  const uid = currentUserId();
  if (input.sessionCode) return `${uid}:${input.exerciseId}:session:${input.sessionCode}`;
  if (input.devoirId) return `${uid}:${input.exerciseId}:devoir:${input.devoirId}`;
  if (input.playToken) return `${uid}:${input.exerciseId}:play:${hash(input.playToken)}`;
  if (input.preview) return `${uid}:${input.exerciseId}:preview`;
  return `${uid}:${input.exerciseId}:none`;
}

function hash(s: string): string {
  // Hash léger et stable pour ne pas stocker le play_token brut en clé.
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return `h${h}`;
}

/** Vide le cache (à appeler au logout / changement d'utilisateur). */
export function clearExerciseAudioCache(): void {
  cache.clear();
}

/** Supprime uniquement l'entrée contextuelle concernée. Ne persiste rien. */
export function invalidateExerciseAudioCache(input: ResolveExerciseAudioInput): void {
  cache.delete(cacheKey(input));
}

export async function resolveExerciseAudio(
  input: ResolveExerciseAudioInput,
  options?: ResolveExerciseAudioOptions,
): Promise<AudioResolution> {
  const key = cacheKey(input);
  const now = Date.now();
  if (options?.forceRefresh) {
    cache.delete(key);
  } else {
    const cached = cache.get(key);
    if (cached && cached.expiresAt > now) {
      return { status: "resolved", url: cached.url, expiresAt: new Date(cached.expiresAt).toISOString() };
    }
  }

  const { data, error } = await supabase.functions.invoke("resolve-exercise-audio", {
    body: {
      exercise_id: input.exerciseId,
      ...(input.sessionCode ? { session_code: input.sessionCode } : {}),
      ...(input.devoirId ? { devoir_id: input.devoirId } : {}),
      ...(input.playToken ? { play_token: input.playToken } : {}),
      ...(input.preview ? { preview: true } : {}),
    },
  });

  if (error) {
    return classifyInvokeError(error);
  }

  if (data && typeof data === "object" && (data as any).ok === true) {
    const url = (data as any).audio_url as string;
    const expiresAt = (data as any).expires_at as string;
    if (typeof url === "string" && typeof expiresAt === "string") {
      const expiresAtMs = Date.parse(expiresAt);
      const ttl = Math.min(CACHE_TTL_MS, Math.max(0, expiresAtMs - now));
      cache.set(key, { url, expiresAt: now + ttl });
      return { status: "resolved", url, expiresAt };
    }
  }

  // Cas défensif : réponse 200 inattendue.
  return { status: "unavailable" };
}
