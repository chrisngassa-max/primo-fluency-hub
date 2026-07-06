import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// BatchStore hors-ligne (BATCH_STORE=file, valeur par defaut en developpement
// sans Supabase configure). Persiste resource_generation_batches /
// resource_generation_jobs (section 8.1) sous forme d'un fichier JSON par
// batch, ce qui permet la reprise (curriculum:resume) et le rapport
// (curriculum:report) entre deux invocations separees du CLI, sans base de
// donnees reelle. `SupabaseBatchStore` respecte la meme interface pour la
// production (section 9).
export class FileBatchStore {
  constructor({ dir = path.resolve(process.cwd(), '.cache', 'curriculum-batches') } = {}) {
    this.dir = dir;
  }

  _filePath(batchId) {
    return path.join(this.dir, `${batchId}.json`);
  }

  async _ensureDir() {
    await mkdir(this.dir, { recursive: true });
  }

  async createBatch({ config }) {
    await this._ensureDir();
    const now = new Date().toISOString();
    const batch = {
      batch_id: randomUUID(),
      created_at: now,
      updated_at: now,
      status: 'running',
      config,
      jobs: {},
    };
    await this._write(batch);
    return batch;
  }

  async getBatch(batchId) {
    const raw = await readFile(this._filePath(batchId), 'utf8').catch((error) => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    return raw ? JSON.parse(raw) : null;
  }

  async listBatches() {
    await this._ensureDir();
    const files = await readdir(this.dir).catch(() => []);
    const batches = await Promise.all(
      files.filter((f) => f.endsWith('.json')).map((f) => readFile(path.join(this.dir, f), 'utf8').then((raw) => JSON.parse(raw))),
    );
    return batches.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }

  async updateBatch(batchId, patch) {
    const batch = await this.getBatch(batchId);
    if (!batch) throw new Error(`file-batch-store: batch introuvable "${batchId}".`);
    const updated = { ...batch, ...patch, updated_at: new Date().toISOString() };
    await this._write(updated);
    return updated;
  }

  async upsertJob(batchId, sessionCode, jobPatch) {
    const batch = await this.getBatch(batchId);
    if (!batch) throw new Error(`file-batch-store: batch introuvable "${batchId}".`);
    const existing = batch.jobs[sessionCode] ?? {
      session_code: sessionCode,
      status: 'queued',
      attempts: 0,
      last_error: null,
      created_at: new Date().toISOString(),
    };
    batch.jobs[sessionCode] = { ...existing, ...jobPatch, session_code: sessionCode, updated_at: new Date().toISOString() };
    batch.updated_at = new Date().toISOString();
    await this._write(batch);
    return batch.jobs[sessionCode];
  }

  async _write(batch) {
    await this._ensureDir();
    await writeFile(this._filePath(batch.batch_id), `${JSON.stringify(batch, null, 2)}\n`, 'utf8');
  }
}
