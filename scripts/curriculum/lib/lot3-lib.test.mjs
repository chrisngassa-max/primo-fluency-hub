import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { toYaml } from './yaml-lite.mjs';
import { FileBatchStore } from './file-batch-store.mjs';
import { FileStoragePublisher } from '../providers/file-storage-publisher.mjs';

describe('yaml-lite — toYaml', () => {
  it('serialise scalaires, tableaux et objets imbriques de maniere lisible', () => {
    const yaml = toYaml({ session_code: 'S01', resources: ['a', 'b'], support: { hash: 'abc', empty: [] } });
    expect(yaml).toContain('session_code: S01');
    expect(yaml).toContain('resources:\n- a\n- b');
    expect(yaml).toContain('support:\n  hash: abc\n  empty: []');
  });

  it('protege les chaines contenant des caracteres speciaux YAML', () => {
    const yaml = toYaml({ titre: 'Accueil : objectifs' });
    expect(yaml).toContain('titre: "Accueil : objectifs"');
  });
});

describe('FileBatchStore (BATCH_STORE=file)', () => {
  let dir;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'captcf-batchstore-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('cree, relit et met a jour un batch et ses jobs', async () => {
    const store = new FileBatchStore({ dir });
    const batch = await store.createBatch({ config: { session_codes: ['S01'] } });
    expect(batch.status).toBe('running');

    await store.upsertJob(batch.batch_id, 'S01', { phase: 'generate', status: 'succeeded', idempotency_key: 'abc' });
    const reloaded = await store.getBatch(batch.batch_id);
    expect(reloaded.jobs.S01.status).toBe('succeeded');
    expect(reloaded.jobs.S01.idempotency_key).toBe('abc');

    await store.updateBatch(batch.batch_id, { status: 'paused' });
    const final = await store.getBatch(batch.batch_id);
    expect(final.status).toBe('paused');
  });

  it('retourne null pour un batch inconnu', async () => {
    const store = new FileBatchStore({ dir });
    expect(await store.getBatch('does-not-exist')).toBeNull();
  });
});

describe('FileStoragePublisher (STORAGE_PUBLISHER=file)', () => {
  let dir;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'captcf-filestorage-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('persiste les octets et le catalogue entre deux instances (simule deux processus CLI)', async () => {
    const first = new FileStoragePublisher({ dir });
    const { sessionId, planVersionId } = await first.resolvePublishContext({ sessionCode: 'S01', planVersionId: 'p1' });
    await first.upload({ bucket: 'curriculum-v2', path: 'S01/test.txt', buffer: Buffer.from('contenu'), contentType: 'text/plain' });
    const row = await first.insertSessionResource({
      session_id: sessionId,
      resource_id: 'S01-test',
      kind: 'test',
      version: 1,
      chemin: 'S01/test.txt',
      mime: 'text/plain',
      hash: 'h1',
      statut: 'published',
    });
    const publication = await first.recordPublication({ planVersionId, sessionResourceId: row.id, version: 1 });

    const second = new FileStoragePublisher({ dir });
    const latest = await second.latestPublication({ sessionResourceId: row.id });
    expect(latest.id).toBe(publication.id);
    expect(latest.version).toBe(1);

    const rowAgain = await second.insertSessionResource({
      session_id: sessionId,
      resource_id: 'S01-test',
      kind: 'test',
      version: 2,
      chemin: 'S01/test.txt',
      mime: 'text/plain',
      hash: 'h2',
      statut: 'published',
      previous_resource_version_id: row.id,
    });
    expect(rowAgain.id).not.toBe(row.id);
    expect(rowAgain.version).toBe(2);
  });
});
