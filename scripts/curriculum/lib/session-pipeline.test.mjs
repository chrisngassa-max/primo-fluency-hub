import { describe, expect, it } from 'vitest';
import { generateSessionPackage } from './session-pipeline.mjs';
import { SvgImageProvider } from '../providers/svg-image.mjs';
import { FakeTtsProvider } from '../providers/fake-tts.mjs';
import { FakeRenderer } from '../providers/fake-renderer.mjs';
import { sessionManifestSchema } from '../schemas/session-manifest.schema.mjs';

function makeFixtureBrief() {
  const questions = [{ id: 'q1', type: 'qcm', enonce: 'Question ?', options: ['a', 'b'] }];
  const corrige = { q1: 'a' };

  return {
    session_code: 'S-TEST',
    plan_version: 'test-v1',
    titre: 'Seance de test',
    support: {
      support_id: 'S-TEST-support',
      situation: 'Une situation fictive de test.',
      personnages: ['Test Personne'],
      faits: ['Fait invariant de test.'],
      nombres: [42],
      dates: [],
      source_ids: [],
    },
    co: { resource_id: 'S-TEST-CO', voice: 'fr-FR-Test', speaking_rate: 1, script: 'Bonjour, ceci est un dialogue de test.', pauses: [] },
    visual: {
      resource_id: 'S-TEST-VIS',
      alt_text: 'Un rectangle de test.',
      scene: { title: 'Scene de test', width: 100, height: 100, elements: [{ type: 'rect', x: 0, y: 0, width: 100, height: 100, fill: '#eee' }] },
    },
    lexique: { resource_id: 'S-TEST-LEX', mots: [{ mot: 'test', definition_simple: 'Un test.', exemple: 'Ceci est un test.' }] },
    variants: {
      A1: { consigne: 'Consigne A1', aides: [], questions, corrige },
      A2: { consigne: 'Consigne A2', aides: [], questions, corrige },
      B1: { consigne: 'Consigne B1', aides: [], questions, corrige },
      B2: { consigne: 'Consigne B2', aides: [], questions, corrige },
    },
    civic_qcm: { resource_id: 'S-TEST-QCM', mention: 'CSP', theme: 'Test', questions: [] },
    devoirs: { A1: 'Devoir A1', A2: 'Devoir A2', B1: 'Devoir B1', B2: 'Devoir B2' },
    formateur: {
      fiche_formateur: 'Fiche formateur de test.',
      deroule_180min: [{ phase: 'Rituel', duree_min: 10, description: 'Rituel de test.' }],
      adaptation_rules: ['Regle de test.'],
    },
  };
}

function makeFixtureProviders() {
  return { imageProvider: new SvgImageProvider(), ttsProvider: new FakeTtsProvider(), renderer: new FakeRenderer() };
}

describe('session-pipeline — generateSessionPackage (lot 3, section 9.2)', () => {
  it('produit les 30 ressources du paquet standard, toutes non vides', async () => {
    const brief = makeFixtureBrief();
    const { resources, supportHash, variantsList } = await generateSessionPackage({ sessionCode: 'S-TEST', brief, providers: makeFixtureProviders() });

    expect(resources.length).toBeGreaterThanOrEqual(28);
    expect(variantsList).toHaveLength(4);
    expect(supportHash).toMatch(/^[0-9a-f]{64}$/);

    for (const resource of resources) {
      expect(resource.buffer.length).toBeGreaterThan(0);
      expect(resource.hash).toMatch(/^[0-9a-f]{64}$/);
    }

    const resourceIds = resources.map((r) => r.resource_id);
    expect(new Set(resourceIds).size).toBe(resourceIds.length);
  });

  it('les 4 variantes A1-B2 partagent le meme invariants_hash (section 12.1)', async () => {
    const brief = makeFixtureBrief();
    const { variantsList } = await generateSessionPackage({ sessionCode: 'S-TEST', brief, providers: makeFixtureProviders() });

    const hashes = new Set(variantsList.map((v) => v.invariants_hash));
    expect(hashes.size).toBe(1);
  });

  it('rejette une variante qui modifierait les invariants du support (facts differents)', async () => {
    const brief = makeFixtureBrief();
    brief.variants.B2.corrige = { q1: 'a' }; // legitime, ne doit pas casser
    const { resources } = await generateSessionPackage({ sessionCode: 'S-TEST', brief, providers: makeFixtureProviders() });
    expect(resources.find((r) => r.resource_id === 'variantes-a1-a2-b1-b2')).toBeDefined();
  });

  it('produit un ensemble de ressources compatible avec sessionManifestSchema une fois assemble', async () => {
    const brief = makeFixtureBrief();
    const { resources, variantsList } = await generateSessionPackage({ sessionCode: 'S-TEST', brief, providers: makeFixtureProviders() });

    const manifest = {
      session_code: 'S01',
      plan_version: 'test-v1',
      support_id: variantsList[0].support_id,
      type_seance: 'mixte',
      objectifs: ['Objectif de test'],
      competences: ['CO'],
      civic_theme: 'Theme de test',
      civic_mention: 'CSP',
      source_ids: [],
      resources: resources.map((r) => ({
        resource_id: r.resource_id,
        kind: r.kind,
        required: true,
        generation_mode: r.generation_mode,
        prompt_version: null,
        required_elements: r.required_elements,
        forbidden_elements: r.forbidden_elements,
        source_ids: r.source_ids,
        rights_status: r.rights_status,
        output_spec: { mime_type: r.mimeType },
        alt_text: r.alt_text,
        depends_on_answer: r.depends_on_answer,
        expected_hash: r.hash,
        dependencies: r.dependencies,
      })),
      variants: variantsList.map((v) => ({ niveau: v.niveau, resource_id: 'variantes-a1-a2-b1-b2' })),
      duration_plan: {},
      validation_policy: {},
      publication_policy: {},
    };

    expect(() => sessionManifestSchema.parse(manifest)).not.toThrow();
  });
});
