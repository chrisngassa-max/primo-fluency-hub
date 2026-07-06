import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateManifest } from './lib/preflight-checks.mjs';
import { computeHoursByPalier, validateCumulativeHours } from './lib/hours.mjs';
import { scanForClientSecrets } from './lib/no-client-secrets.mjs';
import { DEFAULT_MANIFEST_PATH } from './lib/manifest-io.mjs';
import { variantSchema, assertVariantsShareInvariants } from './schemas/variant.schema.mjs';

async function loadRealManifest() {
  const raw = await readFile(DEFAULT_MANIFEST_PATH, 'utf8');
  return JSON.parse(raw);
}

function cloneManifest(manifest) {
  return JSON.parse(JSON.stringify(manifest));
}

describe('curriculum manifest validation (lot 1)', () => {
  it('accepts the real content/curriculum/v2/manifest.json without any API call', async () => {
    const manifest = await loadRealManifest();
    const result = validateManifest(manifest);

    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
    expect(result.data.entries).toHaveLength(41);
  });

  it('rejects a manifest missing a mandatory session (incomplete manifest)', async () => {
    const manifest = cloneManifest(await loadRealManifest());
    manifest.entries = manifest.entries.filter((entry) => entry.session_code !== 'S17');

    const result = validateManifest(manifest);

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('S17'))).toBe(true);
  });

  it('rejects a manifest with a duplicated session code', async () => {
    const manifest = cloneManifest(await loadRealManifest());
    const s01 = manifest.entries.find((entry) => entry.session_code === 'S01');
    const s02Index = manifest.entries.findIndex((entry) => entry.session_code === 'S02');
    manifest.entries[s02Index] = { ...manifest.entries[s02Index], session_code: 'S01', ordre: s01.ordre };

    const result = validateManifest(manifest);

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.toLowerCase().includes('duplique'))).toBe(true);
  });

  it('rejects a manifest whose hour totals no longer match 80/100/120h', async () => {
    const manifest = cloneManifest(await loadRealManifest());
    const s01Index = manifest.entries.findIndex((entry) => entry.session_code === 'S01');
    manifest.entries[s01Index] = { ...manifest.entries[s01Index], duree_minutes: 90 };

    const result = validateManifest(manifest);

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('A2'))).toBe(true);
  });

  it('rejects a session without a module (session with module=null)', async () => {
    const manifest = cloneManifest(await loadRealManifest());
    const s01Index = manifest.entries.findIndex((entry) => entry.session_code === 'S01');
    manifest.entries[s01Index] = { ...manifest.entries[s01Index], module: null };

    const result = validateManifest(manifest);

    expect(result.valid).toBe(false);
  });
});

describe('validateur de coherence 80/100/120h', () => {
  const baseEntries = [
    ...Array.from({ length: 25 }, (_, i) => ({
      kind: 'session',
      palier: 'A2',
      duree_minutes: 180,
      session_code: `S${String(i + 1).padStart(2, '0')}`,
    })),
    { kind: 'evaluation', palier: 'A2', duree_minutes: 120, session_code: 'E1' },
    { kind: 'evaluation', palier: 'A2', duree_minutes: 180, session_code: 'E2' },
    ...Array.from({ length: 6 }, (_, i) => ({
      kind: 'session',
      palier: 'B1',
      duree_minutes: 180,
      session_code: `S${String(i + 26).padStart(2, '0')}`,
    })),
    { kind: 'evaluation', palier: 'B1', duree_minutes: 120, session_code: 'E3' },
    ...Array.from({ length: 6 }, (_, i) => ({
      kind: 'session',
      palier: 'B2',
      duree_minutes: 180,
      session_code: `S${String(i + 32).padStart(2, '0')}`,
    })),
    { kind: 'evaluation', palier: 'B2', duree_minutes: 120, session_code: 'E4' },
  ];

  it('computes exact cumulative hours for a well-formed plan (80/100/120h)', () => {
    const details = computeHoursByPalier(baseEntries);

    expect(details.A2.heures_cumulees).toBe(80);
    expect(details.B1.heures_cumulees).toBe(100);
    expect(details.B2.heures_cumulees).toBe(120);
  });

  it('passes validation when totals match exactly', () => {
    const { valid, errors } = validateCumulativeHours(baseEntries);
    expect(valid).toBe(true);
    expect(errors).toEqual([]);
  });

  it('fails validation when a single session duration drifts', () => {
    const brokenEntries = baseEntries.map((entry) =>
      entry.session_code === 'S10' ? { ...entry, duree_minutes: 150 } : entry,
    );

    const { valid, errors } = validateCumulativeHours(brokenEntries);
    expect(valid).toBe(false);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('garde-fou secrets cote client (VITE_*)', () => {
  it('flags a sensitive VITE_ variable referenced in client code', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'captcf-secrets-'));
    try {
      await writeFile(
        join(dir, 'bad.ts'),
        'const key = import.meta.env.VITE_ANTHROPIC_API_KEY;\nexport default key;\n',
      );

      const violations = await scanForClientSecrets(dir);
      expect(violations).toHaveLength(1);
      expect(violations[0].varName).toBe('VITE_ANTHROPIC_API_KEY');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('does not flag the allowed public Supabase client variables', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'captcf-secrets-ok-'));
    try {
      await writeFile(
        join(dir, 'client.ts'),
        'const url = import.meta.env.VITE_SUPABASE_URL;\nconst key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;\n',
      );

      const violations = await scanForClientSecrets(dir);
      expect(violations).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('finds no violation in the real src/ directory today', async () => {
    const violations = await scanForClientSecrets('src');
    expect(violations).toEqual([]);
  }, 20000);
});

describe('detection d\'une variante qui modifie le support (section 12.1)', () => {
  const makeVariant = (niveau, overrides = {}) =>
    variantSchema.parse({
      support_id: 'S01-support-accueil',
      niveau,
      consigne: 'Consigne de test',
      questions: [{ id: 'q1', type: 'qcm', enonce: 'Enonce ?' }],
      corrige: { q1: 'a' },
      invariants_hash: 'hash-abc',
      ...overrides,
    });

  it('accepts four A1-B2 variants sharing the same invariants_hash', () => {
    const variants = ['A1', 'A2', 'B1', 'B2'].map((niveau) => makeVariant(niveau));
    expect(() => assertVariantsShareInvariants(variants)).not.toThrow();
  });

  it('rejects a variant whose invariants_hash diverges (support modifie)', () => {
    const variants = [
      makeVariant('A1'),
      makeVariant('A2'),
      makeVariant('B1', { invariants_hash: 'hash-modifie' }),
      makeVariant('B2'),
    ];
    expect(() => assertVariantsShareInvariants(variants)).toThrow(/invariants_hash/);
  });
});
