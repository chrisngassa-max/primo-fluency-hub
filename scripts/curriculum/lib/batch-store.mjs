import { FileBatchStore } from './file-batch-store.mjs';
import { SupabaseBatchStore } from './supabase-batch-store.mjs';

// Factory explicite (meme esprit que les factories de providers du lot 2) :
// BATCH_STORE=file (defaut, developpement hors-ligne) ou
// BATCH_STORE=supabase (production, tables reelles). Aucun repli silencieux.
export function createBatchStore(env = process.env) {
  const mode = env.BATCH_STORE ?? 'file';

  if (mode === 'file') {
    return new FileBatchStore();
  }

  if (mode === 'supabase') {
    return new SupabaseBatchStore({
      supabaseUrl: env.SUPABASE_URL ?? env.VITE_SUPABASE_URL,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
      planVersionId: env.CURRICULUM_PLAN_VERSION_ID,
    });
  }

  throw new Error(`batch-store: BATCH_STORE inconnu "${mode}" (attendu file|supabase).`);
}
