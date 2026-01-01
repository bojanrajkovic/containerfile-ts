// pattern: Imperative Shell

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '../src/index.js';

const fixturesDir = join(import.meta.dirname, 'fixtures');

function getFixtureDirs(): Array<string> {
  return readdirSync(fixturesDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
}

describe('Dockerfile generation', () => {
  const fixtures = getFixtureDirs();

  for (const fixtureName of fixtures) {
    it(`generates correct output for ${fixtureName}`, async () => {
      const fixtureDir = join(fixturesDir, fixtureName);

      // Load the generator
      const generatorPath = join(fixtureDir, 'generator.ts');
      const { fixture } = await import(generatorPath);

      // Load the expected output
      const expectedPath = join(fixtureDir, 'expected.Dockerfile');
      const expected = readFileSync(expectedPath, 'utf-8').trim();

      // Generate and compare
      const generated = render(fixture);

      expect(generated).toBe(expected);
    });
  }
});
