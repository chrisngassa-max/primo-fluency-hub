import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { transformWithOxc } from 'vite';

const SOURCE_PATH = path.join(
  process.cwd(),
  'supabase/functions/generate-session-content/index.ts',
);

describe('generate-session-content — syntaxe', () => {
  it('reste analysable comme TypeScript avant tout deploiement', async () => {
    const source = await readFile(SOURCE_PATH, 'utf8');

    await expect(transformWithOxc(source, SOURCE_PATH)).resolves.toBeDefined();
  });
});