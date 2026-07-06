import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

function syntheticUuid(seed) {
  const hash = createHash('sha256').update(seed).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

// StoragePublisher local persiste sur disque (STORAGE_PUBLISHER=file).
// Contrairement a FakeStoragePublisher (memoire, reinitialise a chaque
// processus, reserve aux tests unitaires), celui-ci ecrit reellement les
// octets et un petit "catalogue" JSON sous .cache/curriculum-storage/, ce
// qui permet d'enchainer generate -> validate -> publish en plusieurs
// invocations CLI separees sans Supabase configure (developpement local).
export class FileStoragePublisher {
  constructor({ dir = path.resolve(process.cwd(), '.cache', 'curriculum-storage') } = {}) {
    this.dir = dir;
    this.catalogPath = path.join(this.dir, 'catalog.json');
  }

  async _loadCatalog() {
    await mkdir(this.dir, { recursive: true });
    const raw = await readFile(this.catalogPath, 'utf8').catch((error) => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    return raw ? JSON.parse(raw) : { rows: {}, publications: [], sessions: {} };
  }

  async _saveCatalog(catalog) {
    await mkdir(this.dir, { recursive: true });
    await writeFile(this.catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
  }

  async upload({ bucket, path: objectPath, buffer, contentType }) {
    const destination = path.join(this.dir, 'buckets', bucket, objectPath);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, buffer);
    return { publicUrl: `file://${destination.replaceAll('\\', '/')}`, bucket, path: objectPath, contentType };
  }

  async upsertRow({ table, row, onConflict }) {
    const catalog = await this._loadCatalog();
    catalog.rows[table] ??= {};
    const key = String(row[onConflict]);
    const stored = { ...row, id: catalog.rows[table][key]?.id ?? randomUUID() };
    catalog.rows[table][key] = stored;
    await this._saveCatalog(catalog);
    return stored;
  }

  async resolvePlanVersionId(planVersionRef) {
    return isUuid(planVersionRef) ? planVersionRef : syntheticUuid(`plan:${planVersionRef}`);
  }

  async resolvePublishContext({ sessionCode, planVersionId }) {
    const resolvedPlanVersionId = await this.resolvePlanVersionId(planVersionId);
    const catalog = await this._loadCatalog();
    catalog.sessions ??= {};
    const sessionKey = `${resolvedPlanVersionId}:${sessionCode}`;
    catalog.sessions[sessionKey] ??= syntheticUuid(`session:${sessionKey}`);
    await this._saveCatalog(catalog);
    return { sessionId: catalog.sessions[sessionKey], planVersionId: resolvedPlanVersionId };
  }

  async latestSessionResource({ sessionId, resourceId }) {
    const catalog = await this._loadCatalog();
    const rows = Object.values(catalog.rows.session_resources ?? {});
    const matches = rows.filter((row) => row.session_id === sessionId && row.resource_id === resourceId);
    if (matches.length === 0) return null;
    return matches.reduce((latest, row) => (row.version > latest.version ? row : latest));
  }

  async insertSessionResource(row) {
    const catalog = await this._loadCatalog();
    catalog.rows.session_resources ??= {};
    const stored = { ...row, id: randomUUID() };
    catalog.rows.session_resources[stored.id] = stored;
    await this._saveCatalog(catalog);
    return stored;
  }

  async supersedeSessionResource({ id }) {
    const catalog = await this._loadCatalog();
    const row = catalog.rows.session_resources?.[id];
    if (!row) return;
    row.statut = 'superseded';
    await this._saveCatalog(catalog);
  }

  async recordPublication({ planVersionId, sessionResourceId, version, publishedBy = 'automation', previousPublicationId = null }) {
    const catalog = await this._loadCatalog();
    const publication = {
      id: randomUUID(),
      plan_version_id: planVersionId,
      session_resource_id: sessionResourceId,
      version,
      published_by: publishedBy,
      previous_publication_id: previousPublicationId,
      published_at: new Date().toISOString(),
    };
    catalog.publications.push(publication);
    await this._saveCatalog(catalog);
    return publication;
  }

  async latestPublication({ sessionResourceId }) {
    const catalog = await this._loadCatalog();
    const matches = catalog.publications.filter((pub) => pub.session_resource_id === sessionResourceId);
    return matches.length > 0 ? matches[matches.length - 1] : null;
  }
}
