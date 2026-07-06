import { createClient } from '@supabase/supabase-js';

// BatchStore reel (BATCH_STORE=supabase) : persiste resource_generation_batches
// et resource_generation_jobs (section 8.1) via le service role. Meme
// interface que FileBatchStore, pour que generate/validate/publish/resume
// puissent rester agnostiques de la persistance choisie.
export class SupabaseBatchStore {
  constructor({ supabaseUrl, serviceRoleKey, planVersionId } = {}) {
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('SupabaseBatchStore requiert SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY.');
    }
    if (!planVersionId) {
      throw new Error('SupabaseBatchStore requiert CURRICULUM_PLAN_VERSION_ID (uuid de training_plan_versions).');
    }
    this.planVersionId = planVersionId;
    this.client = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  async createBatch({ config }) {
    const { data, error } = await this.client
      .from('resource_generation_batches')
      .insert({ plan_version_id: this.planVersionId, configuration: config, etat: 'running', compteurs: {}, rapport: {}, started_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw new Error(`SupabaseBatchStore.createBatch echoue : ${error.message}`);
    return this._toBatch(data, []);
  }

  async getBatch(batchId) {
    const { data: batch, error } = await this.client.from('resource_generation_batches').select('*').eq('id', batchId).maybeSingle();
    if (error) throw new Error(`SupabaseBatchStore.getBatch echoue : ${error.message}`);
    if (!batch) return null;
    const { data: jobs, error: jobsError } = await this.client.from('resource_generation_jobs').select('*').eq('batch_id', batchId);
    if (jobsError) throw new Error(`SupabaseBatchStore.getBatch (jobs) echoue : ${jobsError.message}`);
    return this._toBatch(batch, jobs ?? []);
  }

  async listBatches() {
    const { data, error } = await this.client
      .from('resource_generation_batches')
      .select('*')
      .eq('plan_version_id', this.planVersionId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`SupabaseBatchStore.listBatches echoue : ${error.message}`);
    return Promise.all((data ?? []).map((batch) => this.getBatch(batch.id)));
  }

  async updateBatch(batchId, patch) {
    const row = {};
    if (patch.status) row.etat = patch.status;
    if (patch.config) row.configuration = patch.config;
    if (patch.counters) row.compteurs = patch.counters;
    if (patch.report) row.rapport = patch.report;
    if (patch.status && patch.status !== 'running') row.finished_at = new Date().toISOString();

    const { error } = await this.client.from('resource_generation_batches').update(row).eq('id', batchId);
    if (error) throw new Error(`SupabaseBatchStore.updateBatch echoue : ${error.message}`);
    return this.getBatch(batchId);
  }

  async upsertJob(batchId, sessionCode, jobPatch) {
    let idempotencyKey = jobPatch.idempotency_key;
    // idempotency_key. On récupère alors la clé idempotente déjà stockée
    // pour la séance la plus récemment mise à jour.
    if (!idempotencyKey) {
      const { data: existing, error } = await this.client
        .from('resource_generation_jobs')
        .select('idempotency_key')
        .eq('batch_id', batchId)
        .eq('session_code', sessionCode)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(`SupabaseBatchStore.upsertJob (lookup) echoue : ${error.message}`);
      idempotencyKey = existing?.idempotency_key ?? `${batchId}:${sessionCode}:orchestrator`;
    }

    const phase = jobPatch.phase;
    const row = {
      batch_id: batchId,
      session_code: sessionCode,
      resource_id: jobPatch.resource_id ?? (phase ? String(phase) : '*'),
      idempotency_key: idempotencyKey,
      statut: jobPatch.status ?? 'queued',
      ...(jobPatch.attempts != null ? { tentative: jobPatch.attempts } : {}),
      erreurs: jobPatch.last_error ? [jobPatch.last_error] : [],
      depends_on: jobPatch.depends_on ?? [],
      ...(jobPatch.started_at ? { started_at: jobPatch.started_at } : {}),
      ...(jobPatch.finished_at ? { finished_at: jobPatch.finished_at } : {}),
    };

    const { data, error } = await this.client
      .from('resource_generation_jobs')
      .upsert(row, { onConflict: 'idempotency_key' })
      .select()
      .single();
    if (error) throw new Error(`SupabaseBatchStore.upsertJob echoue : ${error.message}`);
    return data;
  }

  _toBatch(batchRow, jobRows) {
    // Les jobRows peuvent contenir plusieurs lignes pour une même session
    // (idempotency_key different selon les phases). On ne garde que la
    // plus recente (updated_at max) pour obtenir une lecture deterministe.
    const bySession = new Map();
    for (const job of jobRows) {
      const existing = bySession.get(job.session_code);
      const existingUpdatedAt = existing?.updated_at ? new Date(existing.updated_at).getTime() : 0;
      const jobUpdatedAt = job.updated_at ? new Date(job.updated_at).getTime() : 0;
      if (!existing || jobUpdatedAt >= existingUpdatedAt) {
        bySession.set(job.session_code, job);
      }
    }

    const jobs = Object.fromEntries(
      Array.from(bySession.entries()).map(([session_code, job]) => [
        session_code,
        {
          session_code: job.session_code,
          phase: job.resource_id && job.resource_id !== '*' ? job.resource_id : null,
          idempotency_key: job.idempotency_key,
          status: job.statut,
          attempts: job.tentative,
          last_error: job.erreurs?.at(-1) ?? null,
        },
      ]),
    );

    return {
      batch_id: batchRow.id,
      plan_version_id: batchRow.plan_version_id,
      created_at: batchRow.created_at,
      updated_at: batchRow.updated_at,
      status: batchRow.etat,
      config: batchRow.configuration,
      report: batchRow.rapport,
      counters: batchRow.compteurs,
      jobs,
    };
  }
}
