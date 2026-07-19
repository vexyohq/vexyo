import { existsSync } from 'node:fs';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SPEC_VERSION } from '../config';
import { initCommand, renderConfigTemplate } from './init';

const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

afterEach(() => {
  stdout.mockClear();
  stderr.mockClear();
});

describe('renderConfigTemplate', () => {
  it('stdio scaffold matches snapshot', () => {
    expect(renderConfigTemplate('stdio', DEFAULT_SPEC_VERSION)).toMatchSnapshot();
  });

  it('http scaffold matches snapshot', () => {
    expect(renderConfigTemplate('http', DEFAULT_SPEC_VERSION)).toMatchSnapshot();
  });

  it('activates the chosen transport and comments the alternatives + regression', () => {
    const stdio = renderConfigTemplate('stdio', '2025-11-25');
    expect(stdio).toContain("import { defineConfig } from '@vexyo/cli/config';");
    expect(stdio).toContain("specVersion: '2025-11-25',");
    expect(stdio).toMatch(/target: \{\n\s+transport: 'stdio',/); // active, multi-line
    expect(stdio).toContain("// target: { transport: 'http'"); // http commented
    expect(stdio).toContain('// regression: {');

    const http = renderConfigTemplate('http', '2025-11-25');
    expect(http).toMatch(/target: \{\n\s+transport: 'http',/); // active, multi-line
    expect(http).toContain("// target: { transport: 'stdio'"); // stdio commented
  });
});

describe('initCommand', () => {
  it('scaffolds vexyo.config.ts and prints next steps', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'vexyo-init-'));
    const code = await initCommand({ transport: 'stdio', force: false, cwd: dir });
    expect(code).toBe(0);
    expect(existsSync(join(dir, 'vexyo.config.ts'))).toBe(true);
    const out = stdout.mock.calls.map((c) => String(c[0])).join('');
    expect(out).toContain('vexyo run --config vexyo.config.ts');
  });

  it('refuses to overwrite an existing config without --force, overwrites with it', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'vexyo-init-'));
    const path = join(dir, 'vexyo.config.ts');
    await writeFile(path, '// existing user config\n');

    // Without --force: refused (exit 2), file untouched.
    expect(await initCommand({ transport: 'stdio', force: false, cwd: dir })).toBe(2);
    expect(await readFile(path, 'utf8')).toBe('// existing user config\n');

    // With --force: overwritten.
    expect(await initCommand({ transport: 'stdio', force: true, cwd: dir })).toBe(0);
    expect(await readFile(path, 'utf8')).toContain('defineConfig');
  });
});
