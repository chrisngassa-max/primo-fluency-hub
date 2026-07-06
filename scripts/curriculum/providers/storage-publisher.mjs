// Interface commune StoragePublisher (section 9.6, section 10 lot 2).
// Contrat : upload({bucket,path,buffer,contentType}) -> {publicUrl}
//           resolvePublishContext({sessionCode,planVersionId}) -> {sessionId,planVersionId}
//           latestSessionResource({sessionId,resourceId}) -> row|null
//           insertSessionResource(row) -> row
//           supersedeSessionResource({id}) -> void
//           upsertRow({table,row,onConflict}) -> row (legacy)
//           recordPublication({planVersionId,sessionResourceId,version,previousPublicationId}) -> publication
//           latestPublication({sessionResourceId}) -> publication|null
// Selection : STORAGE_PUBLISHER=supabase (defaut) | file | fake.
// `file` persiste sur disque sous .cache/curriculum-storage/ : utile en
// developpement local pour enchainer generate/validate/publish sur
// plusieurs invocations CLI sans Supabase configure. `fake` reste reserve
// aux tests unitaires (memoire, non persistant entre processus).

import { SupabaseStoragePublisher } from './supabase-storage-publisher.mjs';
import { FakeStoragePublisher } from './fake-storage-publisher.mjs';
import { FileStoragePublisher } from './file-storage-publisher.mjs';

export function createStoragePublisher(env = process.env) {
  const providerName = (env.STORAGE_PUBLISHER ?? 'supabase').toLowerCase();

  if (providerName === 'fake') return new FakeStoragePublisher();
  if (providerName === 'file') return new FileStoragePublisher();
  if (providerName === 'supabase') {
    return new SupabaseStoragePublisher({
      supabaseUrl: env.SUPABASE_URL ?? env.VITE_SUPABASE_URL,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    });
  }

  throw new Error(`STORAGE_PUBLISHER inconnu : "${providerName}". Valeurs supportees : supabase, file, fake.`);
}
