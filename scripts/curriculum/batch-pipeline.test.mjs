import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runGenerateBatch } from './generate-batch.mjs';
import { validateOneSession } from './validate-batch.mjs';
import { publishOneSession } from './publish-batch.mjs';
import { FileBatchStore } from './lib/file-batch-store.mjs';
import { FileStoragePublisher } from './providers/file-storage-publisher.mjs';
import { SvgImageProvider } from './providers/svg-image.mjs';
import { FakeTtsProvider } from './providers/fake-tts.mjs';
import { FakeRenderer } from './providers/fake-renderer.mjs';
import { FakeContentProvider } from './providers/fake-content.mjs';
import { createFakeSupabaseClient } from './lib/test-helpers/fake-supabase-client.mjs';

// Lot 3 â€” verifie generate/validate/publish/resume "en vrai" (fichiers reels
// sur disque, batch/storage persistes) mais dans des repertoires temporaires
// isoles, sans jamais toucher content/curriculum/v2/ ni .cache/ du depot.

const FIXTURE_BRIEF = {
  session_code: 'S00',
  plan_version: 'test-v1',
  titre: 'Seance de test',
  support: {
    support_id: 'S00-support',
    situation: 'Situation fictive.',
    personnages: ['Personne test'],
    faits: ['Fait invariant.'],
    nombres: [1],
    dates: [],
    source_ids: [],
  },
  co: { resource_id: 'S00-CO', voice: 'fr-FR-Test', speaking_rate: 1, script: 'Dialogue de test suffisamment long pour un test.', pauses: [] },
  visual: {
    resource_id: 'S00-VIS',
    alt_text: 'Rectangle de test.',
    scene: { title: 'Scene test', width: 80, height: 80, elements: [{ type: 'rect', x: 0, y: 0, width: 80, height: 80, fill: '#fff' }] },
  },
  lexique: { resource_id: 'S00-LEX', mots: [{ mot: 'test', definition_simple: 'def', exemple: 'ex' }] },
  variants: {
    A1: { consigne: 'C A1', aides: [], questions: [{ id: 'q1', type: 'qcm', enonce: '?', options: ['a'] }], corrige: { q1: 'a' } },
    A2: { consigne: 'C A2', aides: [], questions: [{ id: 'q1', type: 'qcm', enonce: '?', options: ['a'] }], corrige: { q1: 'a' } },
    B1: { consigne: 'C B1', aides: [], questions: [{ id: 'q1', type: 'qcm', enonce: '?', options: ['a'] }], corrige: { q1: 'a' } },
    B2: { consigne: 'C B2', aides: [], questions: [{ id: 'q1', type: 'qcm', enonce: '?', options: ['a'] }], corrige: { q1: 'a' } },
  },
  civic_qcm: { resource_id: 'S00-QCM', mention: 'CSP', theme: 'Test', questions: [] },
  devoirs: { A1: 'D A1', A2: 'D A2', B1: 'D B1', B2: 'D B2' },
  formateur: { fiche_formateur: 'Fiche test.', deroule_180min: [{ phase: 'Rituel', duree_min: 10, description: 'desc' }], adaptation_rules: ['regle'] },
};

const MANIFEST_JSON = {
  plan_version: 'test-v1',
  entries: [
    {
      session_code: 'S00',
      ordre: 1,
      type_seance: 'mixte',
      objectifs: ['Objectif de test'],
      competences: ['CO'],
      civic_theme: 'Theme test',
      civic_mention: 'CSP',
      source_ids: [],
    },
  ],
};

function noop() {}

describe('Lot 3 â€” pipeline generate/validate/publish/resume (repertoires temporaires)', () => {
  let contentDir;
  let batchDir;
  let storageDir;

  beforeEach(async () => {
    contentDir = await mkdtemp(path.join(tmpdir(), 'captcf-content-'));
    batchDir = await mkdtemp(path.join(tmpdir(), 'captcf-batches-'));
    storageDir = await mkdtemp(path.join(tmpdir(), 'captcf-storage-'));
    await mkdir(path.join(contentDir, 'S00'), { recursive: true });
    await writeFile(path.join(contentDir, 'S00', 'brief.json'), JSON.stringify(FIXTURE_BRIEF, null, 2), 'utf8');
  });

  afterEach(async () => {
    await rm(contentDir, { recursive: true, force: true });
    await rm(batchDir, { recursive: true, force: true });
    await rm(storageDir, { recursive: true, force: true });
  });

  function fakeProviders() {
    return { imageProvider: new SvgImageProvider(), ttsProvider: new FakeTtsProvider(), renderer: new FakeRenderer() };
  }

  it('genere, valide et publie une seance de bout en bout', async () => {
    const batchStore = new FileBatchStore({ dir: batchDir });
    const providerConfig = { content: 'fake', image: 'svg', tts: 'fake', renderer: 'fake', storage: 'file' };
    let batch = await batchStore.createBatch({ config: { session_codes: ['S00'], providers: providerConfig } });

    const generateSummary = await runGenerateBatch({
      sessionCodes: ['S00'],
      manifestJson: MANIFEST_JSON,
      providers: fakeProviders(),
      providerConfig,
      batchStore,
      batch,
      baseDir: contentDir,
      log: noop,
    });
    expect(generateSummary.generated).toEqual(['S00']);

    batch = await batchStore.getBatch(batch.batch_id);
    expect(batch.jobs['S00'].status).toBe('succeeded');
    expect(batch.jobs['S00'].resource_count).toBeGreaterThan(20);

    const contentProvider = new FakeContentProvider();
    const validation = await validateOneSession({ sessionCode: 'S00', contentProvider, baseDir: contentDir });
    expect(validation.generated).toBe(true);
    expect(validation.report.publishable).toBe(true);
    expect(validation.report.blocking_resources).toEqual([]);

    const storagePublisher = new FileStoragePublisher({ dir: storageDir });
    const publication = await publishOneSession({ sessionCode: 'S00', storagePublisher, planVersionId: 'plan-test', baseDir: contentDir });
    expect(publication.published).toBe(true);
    expect(publication.publishedResources.every((r) => r.version === 1)).toBe(true);

    // Republication : nouvelle version, lien vers la version precedente conserve (section 9.6/9.7).
    const republication = await publishOneSession({ sessionCode: 'S00', storagePublisher, planVersionId: 'plan-test', baseDir: contentDir });
    expect(republication.publishedResources.every((r) => r.version === 2)).toBe(true);
  }, 15_000);

  it('reprend sans regenerer une seance deja au statut succeeded avec la meme idempotency_key (section 9.5)', async () => {
    const batchStore = new FileBatchStore({ dir: batchDir });
    const providerConfig = { content: 'fake', image: 'svg', tts: 'fake', renderer: 'fake', storage: 'file' };
    let batch = await batchStore.createBatch({ config: { session_codes: ['S00'], providers: providerConfig } });

    await runGenerateBatch({
      sessionCodes: ['S00'],
      manifestJson: MANIFEST_JSON,
      providers: fakeProviders(),
      providerConfig,
      batchStore,
      batch,
      baseDir: contentDir,
      log: noop,
    });

    batch = await batchStore.getBatch(batch.batch_id);
    const firstResourceCount = batch.jobs['S00'].resource_count;

    const secondSummary = await runGenerateBatch({
      sessionCodes: ['S00'],
      manifestJson: MANIFEST_JSON,
      providers: fakeProviders(),
      providerConfig,
      batchStore,
      batch,
      baseDir: contentDir,
      log: noop,
    });

    expect(secondSummary.skippedAlreadyGenerated).toEqual(['S00']);
    expect(secondSummary.generated).toEqual([]);

    batch = await batchStore.getBatch(batch.batch_id);
    expect(batch.jobs['S00'].resource_count).toBe(firstResourceCount);
  });

  it('met en quarantaine apres 3 tentatives en echec, sans bloquer les autres seances (section 9.5)', async () => {
    const batchStore = new FileBatchStore({ dir: batchDir });
    const providerConfig = { content: 'fake', image: 'svg', tts: 'fake', renderer: 'broken' };
    const batch = await batchStore.createBatch({ config: { session_codes: ['S00'], providers: providerConfig } });

    const brokenRenderer = {
      async renderHtmlToPdf() {
        throw new Error('Panne simulee du renderer.');
      },
      async renderSvgToRaster() {
        throw new Error('Panne simulee du renderer.');
      },
    };

    const summary = await runGenerateBatch({
      sessionCodes: ['S00'],
      manifestJson: MANIFEST_JSON,
      providers: { imageProvider: new SvgImageProvider(), ttsProvider: new FakeTtsProvider(), renderer: brokenRenderer },
      providerConfig,
      batchStore,
      batch,
      baseDir: contentDir,
      log: noop,
    });

    expect(summary.quarantined).toEqual(['S00']);
    expect(summary.generated).toEqual([]);

    const finalBatch = await batchStore.getBatch(batch.batch_id);
    expect(finalBatch.jobs['S00'].status).toBe('quarantined');
    expect(finalBatch.jobs['S00'].attempts).toBe(3);
    expect(finalBatch.jobs['S00'].last_error).toContain('Panne simulee');
  });

  it('ignore une seance sans brief.json (contenu pas encore redige, lot 4)', async () => {
    const batchStore = new FileBatchStore({ dir: batchDir });
    const providerConfig = { content: 'fake', image: 'svg', tts: 'fake', renderer: 'fake' };
    const manifestWithExtra = {
      ...MANIFEST_JSON,
      entries: [...MANIFEST_JSON.entries, { session_code: 'S38', ordre: 2, type_seance: 'mixte', objectifs: ['x'], competences: ['CO'], civic_theme: null, civic_mention: null, source_ids: [] }],
    };
    const batch = await batchStore.createBatch({ config: { session_codes: ['S00', 'S38'], providers: providerConfig } });

    const summary = await runGenerateBatch({
      sessionCodes: ['S00', 'S38'],
      manifestJson: manifestWithExtra,
      providers: fakeProviders(),
      providerConfig,
      batchStore,
      batch,
      baseDir: contentDir,
      log: noop,
    });

    expect(summary.generated).toEqual(['S00']);
    expect(summary.skippedNoBrief).toEqual(['S38']);
  });

  it('publie le PDF/les ressources storage meme quand le pont bloque la famille A1-B2 (independance storage vs pont)', async () => {
    const batchStore = new FileBatchStore({ dir: batchDir });
    const providerConfig = { content: 'fake', image: 'svg', tts: 'fake', renderer: 'fake', storage: 'file' };
    const batch = await batchStore.createBatch({ config: { session_codes: ['S00'], providers: providerConfig } });

    // Brief identique a FIXTURE_BRIEF, sauf B2 dont la question a un type
    // reconnu mais non restituable par le frontend (qcm_multiple) — doit
    // bloquer la famille dans le pont SANS jamais empecher la publication
    // du PDF/des ressources documentaires (deja publiees avant l'appel au pont).
    const briefWithBlockedB2 = {
      ...FIXTURE_BRIEF,
      variants: {
        ...FIXTURE_BRIEF.variants,
        B2: {
          ...FIXTURE_BRIEF.variants.B2,
          questions: [{ id: 'q1', type: 'qcm_multiple', enonce: '?', options: ['a'] }],
        },
      },
    };
    await writeFile(path.join(contentDir, 'S00', 'brief.json'), JSON.stringify(briefWithBlockedB2, null, 2), 'utf8');

    await runGenerateBatch({
      sessionCodes: ['S00'],
      manifestJson: MANIFEST_JSON,
      providers: fakeProviders(),
      providerConfig,
      batchStore,
      batch,
      baseDir: contentDir,
      log: noop,
    });

    // Confirme que le type bloque a bien atteint le fichier genere (sinon le
    // reste du test ne prouverait rien).
    const variantsPath = path.join(contentDir, 'S00', 'exercices', 'variantes-A1-A2-B1-B2.json');
    const generatedVariants = JSON.parse(await (await import('node:fs/promises')).readFile(variantsPath, 'utf8'));
    const b2 = generatedVariants.find((v) => v.niveau === 'B2');
    expect(b2.questions[0].type).toBe('qcm_multiple');
    // Le brief de fixture generique ne porte pas de family_id : avec 4
    // niveaux sans family_id, le pont classe desormais cette famille comme
    // "non identifiee" (voir publish-bridge.mjs) — donc `blocked`, pas
    // `partial_draft`. On ne modifie pas le fichier genere ici (le hash
    // d'integrite de la ressource storage le rejetterait) : le cas
    // family_id present + un seul niveau bloque -> `partial_draft` est
    // couvert par des fixtures dediees dans publish-bridge.test.mjs.

    const contentProvider = new FakeContentProvider();
    const validation = await validateOneSession({ sessionCode: 'S00', contentProvider, baseDir: contentDir });
    expect(validation.report.publishable).toBe(true);

    const storagePublisher = new FileStoragePublisher({ dir: storageDir });
    storagePublisher.client = createFakeSupabaseClient({
      user_roles: [{ user_id: 'formateur-test', role: 'admin' }],
      points_a_maitriser: [{ id: 'point-test' }],
    });

    const publication = await publishOneSession({ sessionCode: 'S00', storagePublisher, planVersionId: 'plan-test', baseDir: contentDir });

    // Le PDF / les ressources documentaires SONT publies (independance totale).
    expect(publication.published).toBe(true);
    expect(publication.publishedResources.length).toBeGreaterThan(0);

    // La famille, elle, reste bloquee — aucune ligne `exercices` creee pour
    // aucun niveau, meme les niveaux valides (pas de publication silencieuse).
    expect(publication.bridge.bridged).toBe(true);
    expect(publication.bridge.families[0].status).toBe('blocked');
    expect(publication.bridge.families[0].kind).toBe('unidentified_family');
    expect(publication.bridge.families[0].published).toBe(false);
    expect(publication.bridge.exercice_ids).toEqual([]);
    expect(storagePublisher.client.__dump('exercices')).toHaveLength(0);
  });
});
