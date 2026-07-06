import { createHash, randomUUID } from 'node:crypto';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

function syntheticUuid(seed) {
  const hash = createHash('sha256').update(seed).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

// StoragePublisher de test : tout est garde en memoire, aucun reseau,
// aucune base reelle. Permet de verifier la logique de publication (lien
// vers la version precedente, historique) sans dependre de Supabase.
export class FakeStoragePublisher {
  constructor() {
    this.uploads = new Map(); // `${bucket}/${path}` -> buffer/contentType
    this.rows = new Map(); // table -> Map(onConflictKeyValue -> row)
    this.sessionResources = new Map(); // id -> row
    this.sessions = new Map(); // `${planVersionId}:${sessionCode}` -> sessionId
    this.publications = [];
  }

  async upload({ bucket, path, buffer, contentType }) {
    const key = `${bucket}/${path}`;
    this.uploads.set(key, { buffer, contentType });
    return { publicUrl: `fake://${key}`, bucket, path };
  }

  async upsertRow({ table, row, onConflict }) {
    if (!this.rows.has(table)) this.rows.set(table, new Map());
    const tableRows = this.rows.get(table);
    const key = row[onConflict];
    const stored = { ...row, id: tableRows.get(key)?.id ?? `${table}-${tableRows.size + 1}` };
    tableRows.set(key, stored);
    return stored;
  }

  async resolvePlanVersionId(planVersionRef) {
    return isUuid(planVersionRef) ? planVersionRef : syntheticUuid(`plan:${planVersionRef}`);
  }

  async resolvePublishContext({ sessionCode, planVersionId }) {
    const resolvedPlanVersionId = await this.resolvePlanVersionId(planVersionId);
    const sessionKey = `${resolvedPlanVersionId}:${sessionCode}`;
    if (!this.sessions.has(sessionKey)) {
      this.sessions.set(sessionKey, syntheticUuid(`session:${sessionKey}`));
    }
    return { sessionId: this.sessions.get(sessionKey), planVersionId: resolvedPlanVersionId };
  }

  async latestSessionResource({ sessionId, resourceId }) {
    const matches = [...this.sessionResources.values()].filter(
      (row) => row.session_id === sessionId && row.resource_id === resourceId,
    );
    if (matches.length === 0) return null;
    return matches.reduce((latest, row) => (row.version > latest.version ? row : latest));
  }

  async insertSessionResource(row) {
    const stored = { ...row, id: randomUUID() };
    this.sessionResources.set(stored.id, stored);
    return stored;
  }

  async supersedeSessionResource({ id }) {
    const row = this.sessionResources.get(id);
    if (row) row.statut = 'superseded';
  }

  async recordPublication({ planVersionId, sessionResourceId, version, publishedBy = 'automation', previousPublicationId = null }) {
    const publication = {
      id: `pub-${this.publications.length + 1}`,
      plan_version_id: planVersionId,
      session_resource_id: sessionResourceId,
      version,
      published_by: publishedBy,
      previous_publication_id: previousPublicationId,
      published_at: new Date().toISOString(),
    };
    this.publications.push(publication);
    return publication;
  }

  async latestPublication({ sessionResourceId }) {
    // Les publications sont ajoutees en ordre chronologique d'appel ; on
    // s'appuie sur cet ordre plutot que sur `published_at` (qui peut
    // partager la meme milliseconde lors de tests rapides successifs).
    const matches = this.publications.filter((pub) => pub.session_resource_id === sessionResourceId);
    return matches.length > 0 ? matches[matches.length - 1] : null;
  }
}
