import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { syncPublishBridge } from './publish-bridge.mjs';
import { createFakeSupabaseClient } from './test-helpers/fake-supabase-client.mjs';

// Verifie l'ATOMICITE DES FAMILLES : une famille A1/A2/B1/B2 ne doit jamais
// etre publiee partiellement dans `exercices` sans derogation explicite.
// Chaque test ecrit ses propres fixtures dans un repertoire temporaire
// (jamais content/curriculum/v2/ du depot) et utilise un client Supabase
// factice en memoire (aucune base reelle touchee).

function questionValid(id) {
  return { id, type: 'qcm', enonce: `Question ${id} ?`, options: ['a', 'b'] };
}

function questionBlocked(id) {
  // Type reconnu mais non restituable par le frontend (voir UnsupportedFrontendFormatError).
  return { id, type: 'qcm_multiple', enonce: `Question ${id} ?`, options: ['a', 'b'] };
}

function variant(niveau, { familyId = 'S00_CE_TEST_01', blocked = false } = {}) {
  return {
    support_id: 'S00-support',
    family_id: familyId,
    version: 1,
    niveau,
    competence: 'CE',
    consigne: `Consigne ${niveau}`,
    aides: [],
    questions: [blocked ? questionBlocked(`${niveau}-q1`) : questionValid(`${niveau}-q1`)],
    corrige: { [`${niveau}-q1`]: 'a' },
    invariants_hash: 'hash-test',
  };
}

function makeClient() {
  return createFakeSupabaseClient({
    user_roles: [{ user_id: 'formateur-test', role: 'admin' }],
    points_a_maitriser: [{ id: 'point-test' }],
  });
}

describe('syncPublishBridge — atomicite des familles', () => {
  let baseDir;

  beforeEach(async () => {
    baseDir = await mkdtemp(path.join(tmpdir(), 'captcf-bridge-'));
    await mkdir(path.join(baseDir, 'S00', 'support'), { recursive: true });
    await mkdir(path.join(baseDir, 'S00', 'exercices'), { recursive: true });
    await writeFile(
      path.join(baseDir, 'S00', 'support', 'support-master.json'),
      JSON.stringify({ support_id: 'S00-support', hash: 'sha256:test', source_ids: [] }, null, 2),
      'utf8',
    );
  });

  afterEach(async () => {
    await rm(baseDir, { recursive: true, force: true });
  });

  async function writeVariants(variants) {
    await writeFile(
      path.join(baseDir, 'S00', 'exercices', 'variantes-A1-A2-B1-B2.json'),
      JSON.stringify(variants, null, 2),
      'utf8',
    );
  }

  it('publie une famille entierement valide (statut complete)', async () => {
    await writeVariants([variant('A1'), variant('A2'), variant('B1'), variant('B2')]);
    const client = makeClient();

    const result = await syncPublishBridge({
      storagePublisher: { client },
      sessionCode: 'S00',
      sessionId: 'session-test',
      baseDir,
    });

    expect(result.bridged).toBe(true);
    expect(result.families).toHaveLength(1);
    expect(result.families[0].status).toBe('complete');
    expect(result.families[0].published).toBe(true);
    expect(result.families[0].niveaux_valides.sort()).toEqual(['A1', 'A2', 'B1', 'B2']);
    expect(result.exercice_ids).toHaveLength(4);
    expect(client.__dump('exercices')).toHaveLength(4);
    expect(result.blocked_variants).toEqual([]);
    expect(result.families_requiring_override).toEqual([]);
  });

  it('bloque toute la famille si UNE SEULE variante est invalide (aucune publication silencieuse)', async () => {
    await writeVariants([variant('A1'), variant('A2'), variant('B1'), variant('B2', { blocked: true })]);
    const client = makeClient();

    const result = await syncPublishBridge({
      storagePublisher: { client },
      sessionCode: 'S00',
      sessionId: 'session-test',
      baseDir,
    });

    expect(result.families).toHaveLength(1);
    const family = result.families[0];
    expect(family.status).toBe('partial_draft');
    // Preuve d'absence de publication silencieuse : la famille N'EST PAS publiee
    // meme si 3 niveaux sur 4 sont valides.
    expect(family.published).toBe(false);
    expect(family.requires_override).toBe(true);
    expect(family.niveaux_bloques).toEqual([
      expect.objectContaining({ niveau: 'B2', reason: 'DIFF_FRONTEND_NOT_SUPPORTED', question_type: 'qcm_multiple' }),
    ]);
    // Aucune ligne ecrite en base pour cette famille — ni les 3 valides, ni la bloquee.
    expect(client.__dump('exercices')).toHaveLength(0);
    expect(result.exercice_ids).toEqual([]);
    expect(result.families_requiring_override).toEqual(['S00_CE_TEST_01']);
  });

  it('passe au statut "blocked" (pas "partial_draft") quand TOUTES les variantes sont invalides', async () => {
    await writeVariants([
      variant('A1', { blocked: true }),
      variant('A2', { blocked: true }),
      variant('B1', { blocked: true }),
      variant('B2', { blocked: true }),
    ]);
    const client = makeClient();

    const result = await syncPublishBridge({
      storagePublisher: { client },
      sessionCode: 'S00',
      sessionId: 'session-test',
      baseDir,
    });

    const family = result.families[0];
    expect(family.status).toBe('blocked');
    expect(family.published).toBe(false);
    expect(family.niveaux_bloques).toHaveLength(4);
    expect(client.__dump('exercices')).toHaveLength(0);
  });

  it('plusieurs variantes bloquees restent toutes tracees dans blocked_variants', async () => {
    await writeVariants([
      variant('A1'),
      variant('A2', { blocked: true }),
      variant('B1', { blocked: true }),
      variant('B2'),
    ]);
    const client = makeClient();

    const result = await syncPublishBridge({
      storagePublisher: { client },
      sessionCode: 'S00',
      sessionId: 'session-test',
      baseDir,
    });

    expect(result.families[0].status).toBe('partial_draft');
    expect(result.blocked_variants).toHaveLength(2);
    expect(result.blocked_variants.map((b) => b.niveau).sort()).toEqual(['A2', 'B1']);
    expect(client.__dump('exercices')).toHaveLength(0);
  });

  it('la publication du pont reste independante des ressources storage/PDF (le pont ne fait jamais echouer la publication documentaire)', async () => {
    // Ce test verifie le contrat au niveau du pont lui-meme : meme quand une
    // famille est entierement bloquee, syncPublishBridge se termine sans
    // exception (bridged: true) — c'est cette propriete qui permet a
    // publish-batch.mjs de publier le PDF/les ressources storage AVANT
    // d'appeler le pont, sans jamais annuler cette publication si le pont
    // bloque une famille (voir publishOneSession : le pont est appele apres
    // coup, dans un bloc try/catch qui n'affecte jamais `published: true`).
    await writeVariants([variant('A1', { blocked: true })]);
    const client = makeClient();

    const result = await syncPublishBridge({
      storagePublisher: { client },
      sessionCode: 'S00',
      sessionId: 'session-test',
      baseDir,
    });

    expect(result.bridged).toBe(true);
    expect(result.families[0].status).toBe('blocked');
    expect(result.families[0].published).toBe(false);
  });

  it('derogation explicite (allowPartialFamily) publie uniquement les variantes valides, jamais annoncee "complete"', async () => {
    await writeVariants([variant('A1'), variant('A2'), variant('B1'), variant('B2', { blocked: true })]);
    const client = makeClient();

    const result = await syncPublishBridge({
      storagePublisher: { client },
      sessionCode: 'S00',
      sessionId: 'session-test',
      baseDir,
      allowPartialFamily: true,
    });

    const family = result.families[0];
    expect(family.status).toBe('partial_draft'); // jamais 'complete' avec une derogation
    expect(family.published).toBe(true);
    expect(family.niveaux_valides.sort()).toEqual(['A1', 'A2', 'B1']);
    expect(family.niveaux_bloques.map((b) => b.niveau)).toEqual(['B2']);
    expect(client.__dump('exercices')).toHaveLength(3);
    expect(result.exercice_ids).toHaveLength(3);
    // La derogation ne republie pas la variante bloquee elle-meme.
    expect(client.__dump('exercices').every((row) => row.niveau_vise !== 'B2')).toBe(true);
  });

  it('BLOQUE une tentative de famille multi-niveaux sans family_id (defaut de donnee, pas un exercice autonome)', async () => {
    const legacyVariant = (niveau) => {
      const v = variant(niveau);
      delete v.family_id;
      return v;
    };
    await writeVariants([legacyVariant('A1'), legacyVariant('A2'), legacyVariant('B1'), legacyVariant('B2')]);
    const client = makeClient();

    const result = await syncPublishBridge({
      storagePublisher: { client },
      sessionCode: 'S00',
      sessionId: 'session-test',
      baseDir,
    });

    expect(result.families).toHaveLength(1);
    expect(result.families[0].family_id).toBe('S00:__unidentified_family__');
    expect(result.families[0].kind).toBe('unidentified_family');
    expect(result.families[0].status).toBe('blocked');
    expect(result.families[0].identity_error.reason).toBe('DIFF_FAMILY_ID_MISSING');
    expect(result.families[0].published).toBe(false);
    expect(client.__dump('exercices')).toHaveLength(0);
  });

  it('la derogation NE PUBLIE JAMAIS une famille dont l\'identite (family_id) est inconnue, meme avec allowPartialFamily', async () => {
    const legacyVariant = (niveau) => {
      const v = variant(niveau);
      delete v.family_id;
      return v;
    };
    await writeVariants([legacyVariant('A1'), legacyVariant('A2'), legacyVariant('B1'), legacyVariant('B2')]);
    const client = makeClient();

    const result = await syncPublishBridge({
      storagePublisher: { client },
      sessionCode: 'S00',
      sessionId: 'session-test',
      baseDir,
      allowPartialFamily: true,
    });

    // La derogation ne couvre que des niveaux individuellement invalides
    // dans une famille par ailleurs identifiee — jamais une identite manquante.
    expect(result.families[0].status).toBe('blocked');
    expect(result.families[0].published).toBe(false);
    expect(client.__dump('exercices')).toHaveLength(0);
  });

  it('ACCEPTE un exercice autonome legacy : un seul niveau sans family_id dans tout le fichier', async () => {
    const legacySolo = variant('A2');
    delete legacySolo.family_id;
    await writeVariants([legacySolo]);
    const client = makeClient();

    const result = await syncPublishBridge({
      storagePublisher: { client },
      sessionCode: 'S00',
      sessionId: 'session-test',
      baseDir,
    });

    expect(result.families).toHaveLength(1);
    const family = result.families[0];
    expect(family.kind).toBe('standalone_legacy');
    expect(family.identity_error).toBeNull();
    // Pas de famille A1-B2 a completer : un seul niveau publie et c'est complet.
    expect(family.status).toBe('complete');
    expect(family.niveaux_manquants).toEqual([]);
    expect(family.published).toBe(true);
    expect(client.__dump('exercices')).toHaveLength(1);
  });

  it('BLOQUE une famille declaree dont une variante ne porte aucune competence', async () => {
    const noCompetence = variant('B2');
    delete noCompetence.competence;
    await writeVariants([variant('A1'), variant('A2'), variant('B1'), noCompetence]);
    const client = makeClient();

    const result = await syncPublishBridge({
      storagePublisher: { client },
      sessionCode: 'S00',
      sessionId: 'session-test',
      baseDir,
    });

    const family = result.families[0];
    expect(family.status).toBe('blocked');
    expect(family.identity_error.reason).toBe('DIFF_COMPETENCE_MISSING');
    expect(family.published).toBe(false);
    expect(client.__dump('exercices')).toHaveLength(0);
  });

  it('BLOQUE une famille declaree dont les niveaux ne partagent pas la meme competence', async () => {
    const wrongCompetence = { ...variant('B2'), competence: 'EE' };
    await writeVariants([variant('A1'), variant('A2'), variant('B1'), wrongCompetence]);
    const client = makeClient();

    const result = await syncPublishBridge({
      storagePublisher: { client },
      sessionCode: 'S00',
      sessionId: 'session-test',
      baseDir,
    });

    const family = result.families[0];
    expect(family.status).toBe('blocked');
    expect(family.identity_error.reason).toBe('DIFF_COMPETENCE_INCONSISTENT');
    expect(family.published).toBe(false);
    expect(client.__dump('exercices')).toHaveLength(0);
  });

  it('BLOQUE (via absence de niveau) une famille declaree incomplete — produit partial_draft, pas blocked, si au moins un niveau est valide', async () => {
    // 3 niveaux valides declares, B2 totalement absent du fichier (pas bloque, ABSENT).
    await writeVariants([variant('A1'), variant('A2'), variant('B1')]);
    const client = makeClient();

    const result = await syncPublishBridge({
      storagePublisher: { client },
      sessionCode: 'S00',
      sessionId: 'session-test',
      baseDir,
    });

    const family = result.families[0];
    expect(family.kind).toBe('declared');
    expect(family.identity_error).toBeNull();
    expect(family.status).toBe('partial_draft');
    expect(family.niveaux_manquants).toEqual(['B2']);
    expect(family.published).toBe(false); // pas de derogation
    expect(client.__dump('exercices')).toHaveLength(0);
  });
});
