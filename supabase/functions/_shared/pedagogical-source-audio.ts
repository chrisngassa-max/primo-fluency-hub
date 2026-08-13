import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

/**
 * Résolution sécurisée de l'audio original d'un exercice CO publié depuis une
 * famille de différenciation A2.
 *
 * Principes de sécurité (à respecter scrupuleusement) :
 *  - Le client ne fournit QUE `exercise_id`. Toute coordonnée Storage est lue
 *    côté serveur depuis `pedagogical_sources` (jamais depuis `exercices.contenu`).
 *  - L'URL signée n'est JAMAIS persistée ; elle est générée ici, courte durée.
 *  - Le JSON `exercices.contenu.audio` n'est PAS autoritatif : la source est
 *    retrouvée via la relation `differentiation_families.published_exercise_id`,
 *    puis on contrôle la cohérence (triple comparaison de hash).
 *  - Aucun fallback TTS sur un original référencé mais défaillant : on retourne
 *    un état discriminé (`stale` / `unavailable`) que l'appelant transforme en
 *    erreur explicite.
 */

export type ExerciseAudioResolution =
  | { status: "resolved"; url: string; expiresAt: string }
  | { status: "no_original_audio" }
  | { status: "stale" }
  | { status: "unavailable"; code: string };

/** Durée de vie de l'URL signée (secondes). Volontairement courte. */
const SIGNED_URL_TTL_SECONDS = 600;

interface ExerciseRow {
  id: string;
  competence: string | null;
  contenu: Record<string, unknown> | null;
}

interface AudioRef {
  source_id: unknown;
  source_content_hash: unknown;
  mime_type: unknown;
}

/**
 * Valide la forme de la référence audio embarquée dans `contenu.audio`.
 * Refuse tout champ Storage (bucket/path) qui n'aurait pas sa place ici.
 */
function readAudioRef(contenu: Record<string, unknown> | null): AudioRef | null {
  if (!contenu || typeof contenu !== "object") return null;
  const audio = (contenu as Record<string, unknown>).audio;
  if (!audio || typeof audio !== "object") return null;
  const ref = audio as Record<string, unknown>;
  if (typeof ref.source_id !== "string" || !ref.source_id) return null;
  if (typeof ref.source_content_hash !== "string" || !ref.source_content_hash) return null;
  return {
    source_id: ref.source_id,
    source_content_hash: ref.source_content_hash,
    mime_type: typeof ref.mime_type === "string" ? ref.mime_type : null,
  };
}

/**
 * Lit `contenu->'metadata'->>'source_stale'`. Positionné à `true` par la RPC
 * transactionnelle de relecture (`validate_pedagogical_source_transcription_review`)
 * lorsqu'une correction invalide un exercice déjà publié.
 */
function isMarkedStale(contenu: Record<string, unknown> | null): boolean {
  if (!contenu) return false;
  const metadata = (contenu as Record<string, unknown>).metadata;
  if (!metadata || typeof metadata !== "object") return false;
  return (metadata as Record<string, unknown>).source_stale === true;
}

/**
 * Résout l'audio original d'un exercice. Toutes les lectures sont faites via le
 * client `admin` (service-role) fourni par l'appelant ; l'autorisation de
 * l'apprenant doit avoir été vérifiée AVANT par l'endpoint appelant.
 */
export async function resolveExerciseAudio(
  admin: SupabaseClient,
  exerciseId: string,
): Promise<ExerciseAudioResolution> {
  // 1. Chargement de l'exercice.
  const { data: exercise, error: exerciseError } = await admin
    .from("exercices")
    .select("id, competence, contenu")
    .eq("id", exerciseId)
    .maybeSingle<ExerciseRow>();
  if (exerciseError) throw exerciseError;
  if (!exercise) return { status: "unavailable", code: "EXERCISE_NOT_FOUND" };

  // Seul le CO porte un audio original issu d'une source pédagogique.
  if ((exercise.competence ?? "").toUpperCase() !== "CO") {
    return { status: "no_original_audio" };
  }

  const audioRef = readAudioRef(exercise.contenu);
  if (!audioRef) return { status: "no_original_audio" };

  // 2. Contrôle famille ↔ source. On ne fait JAMAIS confiance au seul
  //    `source_id` présent dans le JSON : on remonte la famille publiée et on
  //    vérifie qu'elle pointe bien vers cet exercice et cette source.
  const { data: family, error: familyError } = await admin
    .from("differentiation_families")
    .select("id, source_id, source_content_hash, review_status")
    .eq("published_exercise_id", exerciseId)
    .maybeSingle<{
      id: string;
      source_id: string;
      source_content_hash: string;
      review_status: string;
    }>();
  if (familyError) throw familyError;
  if (!family) return { status: "unavailable", code: "NO_PUBLISHED_FAMILY" };
  if (family.review_status !== "published") {
    return { status: "unavailable", code: "FAMILY_NOT_PUBLISHED" };
  }
  if (family.source_id !== audioRef.source_id) {
    return { status: "unavailable", code: "AUDIO_SOURCE_MISMATCH" };
  }

  // 3. Chargement de la source (coordonnées Storage lues côté serveur).
  const { data: source, error: sourceError } = await admin
    .from("pedagogical_sources")
    .select("content_hash, status, review_status, source_kind, storage_bucket, storage_path")
    .eq("id", audioRef.source_id)
    .maybeSingle<{
      content_hash: string | null;
      status: string;
      review_status: string;
      source_kind: string;
      storage_bucket: string | null;
      storage_path: string | null;
    }>();
  if (sourceError) throw sourceError;
  if (!source) return { status: "unavailable", code: "SOURCE_NOT_FOUND" };

  // 4. Triple comparaison de hash. Le JSON de l'exercice n'est PAS autoritatif :
  //    contenu.audio.source_content_hash == family.source_content_hash == source.content_hash.
  const hashes = [
    audioRef.source_content_hash,
    family.source_content_hash,
    source.content_hash,
  ];
  if (!hashes.every((h) => typeof h === "string" && h.startsWith("sha256:")) ||
      new Set(hashes as string[]).size !== 1) {
    return { status: "stale" };
  }

  // 5. Marqueur stale positionné par la RPC de relecture.
  if (isMarkedStale(exercise.contenu)) return { status: "stale" };

  // 6. Contrôles d'état de la source. Une source retombée en brouillon, importée,
  //    en erreur, à remplacer, non analysée, ou non audio ne doit pas être servie.
  if (source.source_kind !== "audio") {
    return { status: "unavailable", code: "SOURCE_NOT_AUDIO" };
  }
  if (source.status !== "analyzed") {
    return { status: "stale" };
  }
  if (source.review_status !== "utilisable" && source.review_status !== "valide") {
    return { status: "stale" };
  }
  if (!source.storage_bucket || !source.storage_path) {
    return { status: "unavailable", code: "STORAGE_REF_MISSING" };
  }

  // 7. Génération de l'URL signée (courte durée). Le service-role contourne le
  //    RLS Storage ; aucune politique de bucket n'est modifiée.
  const { data: signed, error: signedError } = await admin
    .storage
    .from(source.storage_bucket)
    .createSignedUrl(source.storage_path, SIGNED_URL_TTL_SECONDS);
  if (signedError) throw signedError;
  if (!signed?.signedUrl) {
    return { status: "unavailable", code: "STORAGE_ERROR" };
  }

  const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString();
  return { status: "resolved", url: signed.signedUrl, expiresAt };
}
