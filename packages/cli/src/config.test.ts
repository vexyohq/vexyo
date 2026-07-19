import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { configSchema, loadConfig } from './config';

describe('configSchema', () => {
  it('accepts a stdio target and applies defaults', () => {
    const parsed = configSchema.parse({
      target: { transport: 'stdio', command: 'node', args: ['server.js'] },
    });
    expect(parsed.specVersion).toBe('2025-11-25');
    expect(parsed.security).toBe(false);
    expect(parsed.target.transport).toBe('stdio');
  });

  it('accepts an http target (validation only; execution rejected later)', () => {
    const parsed = configSchema.parse({
      target: { transport: 'http', url: 'http://localhost:3000/mcp' },
    });
    expect(parsed.target.transport).toBe('http');
  });

  it('rejects a target with an unknown transport', () => {
    expect(() => configSchema.parse({ target: { transport: 'carrier-pigeon' } })).toThrow();
  });

  it('rejects a stdio target with no command', () => {
    expect(() => configSchema.parse({ target: { transport: 'stdio' } })).toThrow();
  });
});

describe('loadConfig', () => {
  it('loads and validates the example config file', async () => {
    const here = dirname(fileURLToPath(import.meta.url));
    // packages/cli/src -> repo root -> examples
    const example = resolve(here, '../../../examples/basic.config.ts');
    const config = await loadConfig(example);
    expect(config.target.transport).toBe('stdio');
    expect(config.specVersion).toBe('2025-11-25');
  });

  it('reports a clear error for a missing file', async () => {
    await expect(loadConfig('./does-not-exist.config.ts')).rejects.toThrow(/Could not load config/);
  });
});

describe('regression config', () => {
  it('applies defaults for the regression block', () => {
    const parsed = configSchema.parse({
      target: { transport: 'stdio', command: 'node' },
      regression: { record: { echo: { cases: [{ case: 'basic', arguments: { text: 'hi' } }] } } },
    });
    expect(parsed.regression?.goldenDir).toBe('vexyo/goldens');
    expect(parsed.regression?.failOn).toBe('error');
    expect(parsed.regression?.normalizers).toEqual([]);
    expect(parsed.regression?.record['echo']?.cases[0]?.case).toBe('basic');
  });

  it('is optional', () => {
    const parsed = configSchema.parse({ target: { transport: 'stdio', command: 'node' } });
    expect(parsed.regression).toBeUndefined();
  });
});
