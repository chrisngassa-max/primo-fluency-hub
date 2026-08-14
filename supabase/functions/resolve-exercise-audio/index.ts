import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { resolveExerciseAudio } from "../_shared/pedagogical-source-audio.ts";
import { handleResolveExerciseAudio } from "../_shared/resolve-exercise-audio-handler.ts";

/**
 * resolve-exercise-audio
 *
 * Résout l'URL signée (courte durée) du MP3 original d'un exercice CO publié
 * depuis une famille de différenciation A2. L'URL n'est JAMAIS persistée.
 *
 * Autorisation (exactement UN contexte par requête, sinon AUTH_CONTEXT_AMBIGUOUS) :
 *  - { exercise_id, session_code } : enrollment groupe/séance ET appartenance
 *    exercice↔séance (session_document_links). JWT obligatoire.
 *  - { exercise_id, devoir_id }    : devoirs.id = devoir_id AND eleve = caller
 *    AND exercice_id = exercise_id. JWT obligatoire.
 *  - { exercise_id, play_token }   : jeton public ; play_token + is_live_ready
 *    vérifiés côté serveur. AUCUN JWT requis (mode public).
 *  - { exercise_id, preview }      : JWT formateur propriétaire de l'exercice
 *    (exercices.formateur_id) ou admin. Les apprenants sont refusés.
 *
 * La fonction est déployée avec verify_jwt = false (config.toml) pour permettre
 * le mode play_token public ; TOUTE l'authentification est refaite manuellement
 * ici. Aucune route n'est implicitement authentifiée par un simple identifiant.
 *
 * Réponses : Cache-Control: no-store. On ne journalise jamais l'URL signée,
 * le JWT ni le play_token.
 */

Deno.serve(async (req) => {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  return handleResolveExerciseAudio(req, {
    admin,
    resolveAudio: resolveExerciseAudio,
    getUser: async (token) => {
      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false },
      });
      const { data: userData, error: userError } = await userClient.auth.getUser();
      if (userError || !userData?.user?.id) return null;
      return { id: userData.user.id };
    },
  });
});
