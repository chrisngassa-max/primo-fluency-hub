import { createClient } from '@supabase/supabase-js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

// StoragePublisher reel (section 9.6) : Supabase Storage + tables. Ce
// module fournit les primitives atomiques-par-etape (upload, upsert,
// enregistrement de publication avec previous_publication_id) ; l'ordre
// complet en 9 etapes de la section 9.6 (liaisons seance/exercice, pack
// hors ligne, invalidation de cache) est orchestre par publish-batch.mjs
// (lot 5), qui compose ces primitives.

export class SupabaseStoragePublisher {
  constructor({ supabaseUrl, serviceRoleKey } = {}) {
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error(
        'SupabaseStoragePublisher requiert SUPABASE_URL (ou VITE_SUPABASE_URL) et SUPABASE_SERVICE_ROLE_KEY.',
      );
    }
    this.client = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async upload({ bucket, path, buffer, contentType, upsert = true }) {
    const { error } = await this.client.storage.from(bucket).upload(path, buffer, { contentType, upsert });
    if (error) throw new Error(`Upload storage echoue (${bucket}/${path}) : ${error.message}`);

    const { data } = this.client.storage.from(bucket).getPublicUrl(path);
    return { publicUrl: data.publicUrl, bucket, path };
  }

  async upsertRow({ table, row, onConflict }) {
    const { data, error } = await this.client.from(table).upsert(row, { onConflict }).select().single();
    if (error) throw new Error(`Upsert ${table} echoue : ${error.message}`);
    return data;
  }

  async resolvePlanVersionId(planVersionRef) {
    if (isUuid(planVersionRef)) return planVersionRef;

    const { data, error } = await this.client
      .from('training_plan_versions')
      .select('id')
      .eq('version', planVersionRef)
      .maybeSingle();

    if (error) throw new Error(`Lecture du plan de formation echouee : ${error.message}`);
    if (!data) throw new Error(`Plan version introuvable : ${planVersionRef}`);
    return data.id;
  }

  async resolvePublishContext({ sessionCode, planVersionId }) {
    const resolvedPlanVersionId = await this.resolvePlanVersionId(planVersionId);

    const { data, error } = await this.client
      .from('training_sessions')
      .select('id')
      .eq('plan_version_id', resolvedPlanVersionId)
      .eq('code', sessionCode)
      .maybeSingle();

    if (error) throw new Error(`Lecture de la seance echouee : ${error.message}`);
    if (!data) {
      throw new Error(`Seance ${sessionCode} introuvable pour le plan ${planVersionId}.`);
    }

    return { sessionId: data.id, planVersionId: resolvedPlanVersionId };
  }

  async latestSessionResource({ sessionId, resourceId }) {
    const { data, error } = await this.client
      .from('session_resources')
      .select('*')
      .eq('session_id', sessionId)
      .eq('resource_id', resourceId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`Lecture de la ressource de seance echouee : ${error.message}`);
    return data;
  }

  async insertSessionResource(row) {
    const { data, error } = await this.client.from('session_resources').insert(row).select().single();
    if (error) throw new Error(`Insertion session_resources echouee : ${error.message}`);
    return data;
  }

  async supersedeSessionResource({ id }) {
    const { error } = await this.client.from('session_resources').update({ statut: 'superseded' }).eq('id', id);
    if (error) throw new Error(`Marquage superseded echoue : ${error.message}`);
  }

  /**
   * Enregistre une publication et conserve le lien vers la version
   * precedente (section 9.6, point 9 : "conserver
   * previous_published_version_id"). N'ecrase jamais une ligne
   * `curriculum_publications` existante : chaque publication cree une
   * nouvelle entree, ce qui permet la restauration (section 9.7).
   */
  async recordPublication({ planVersionId, sessionResourceId, version, publishedBy = 'automation', previousPublicationId = null }) {
    const { data, error } = await this.client
      .from('curriculum_publications')
      .insert({
        plan_version_id: planVersionId,
        session_resource_id: sessionResourceId,
        version,
        published_by: publishedBy,
        previous_publication_id: previousPublicationId,
      })
      .select()
      .single();

    if (error) throw new Error(`Enregistrement de publication echoue : ${error.message}`);
    return data;
  }

  async latestPublication({ sessionResourceId }) {
    const { data, error } = await this.client
      .from('curriculum_publications')
      .select('*')
      .eq('session_resource_id', sessionResourceId)
      .order('published_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`Lecture de la derniere publication echouee : ${error.message}`);
    return data;
  }
}
