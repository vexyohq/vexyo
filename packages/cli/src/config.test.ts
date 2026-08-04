import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { configSchema, loadConfig } from './config';
import { toGoldenConfig } from './regression';

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

  it('accepts paths and ignore at both levels', () => {
    const parsed = configSchema.parse({
      target: { transport: 'stdio', command: 'node' },
      regression: {
        paths: { 'content[*].text': 'uuid' },
        ignore: ['meta.elapsedMs'],
        record: {
          report: {
            cases: [{ case: 'default' }],
            paths: { 'structuredContent.items[*].id': ['uuid', 'hex-id'] },
            ignore: ['meta.debug'],
          },
        },
      },
    });
    expect(parsed.regression?.paths).toEqual({ 'content[*].text': 'uuid' });
    expect(parsed.regression?.ignore).toEqual(['meta.elapsedMs']);
    expect(parsed.regression?.record['report']?.paths).toEqual({
      'structuredContent.items[*].id': ['uuid', 'hex-id'],
    });
    expect(parsed.regression?.record['report']?.ignore).toEqual(['meta.debug']);
  });

  it('defaults paths/ignore to empty', () => {
    const parsed = configSchema.parse({
      target: { transport: 'stdio', command: 'node' },
      regression: {},
    });
    expect(parsed.regression?.paths).toEqual({});
    expect(parsed.regression?.ignore).toEqual([]);
  });

  it('rejects a malformed path key with the offending path in the issue', () => {
    const result = configSchema.safeParse({
      target: { transport: 'stdio', command: 'node' },
      regression: { paths: { 'a..b': 'uuid' } },
    });
    expect(result.success).toBe(false);
    const issue = result.success ? undefined : result.error.issues[0];
    expect(issue?.path.join('.')).toBe('regression.paths.a..b');
    expect(issue?.message).toMatch(/Invalid result path/);
  });

  it('accepts sortArrays at both levels, defaulting to empty', () => {
    const parsed = configSchema.parse({
      target: { transport: 'stdio', command: 'node' },
      regression: {
        sortArrays: ['items'],
        record: {
          inventory: {
            cases: [{ case: 'default' }],
            sortArrays: ['structuredContent.items'],
          },
          plain: { cases: [{ case: 'default' }] },
        },
      },
    });
    expect(parsed.regression?.sortArrays).toEqual(['items']);
    expect(parsed.regression?.record['inventory']?.sortArrays).toEqual(['structuredContent.items']);
    // Per-tool must stay undefined when omitted (?? falls back to the defaults);
    // a zod default of [] here would silently disable the regression-level list.
    expect(parsed.regression?.record['plain']?.sortArrays).toBeUndefined();
  });

  it('defaults regression-level sortArrays to empty', () => {
    const parsed = configSchema.parse({
      target: { transport: 'stdio', command: 'node' },
      regression: {},
    });
    expect(parsed.regression?.sortArrays).toEqual([]);
  });

  it('rejects a malformed sortArrays entry', () => {
    const result = configSchema.safeParse({
      target: { transport: 'stdio', command: 'node' },
      regression: { sortArrays: ['items['] },
    });
    expect(result.success).toBe(false);
    expect(result.success ? '' : result.error.issues[0]?.message).toMatch(/unclosed/);
  });

  it('rejects a malformed ignore entry', () => {
    const result = configSchema.safeParse({
      target: { transport: 'stdio', command: 'node' },
      regression: { ignore: ['items['] },
    });
    expect(result.success).toBe(false);
    expect(result.success ? '' : result.error.issues[0]?.message).toMatch(/unclosed/);
  });
});

describe('toGoldenConfig', () => {
  it('threads paths and ignore at both levels', () => {
    const parsed = configSchema.parse({
      target: { transport: 'stdio', command: 'node' },
      regression: {
        normalizers: ['iso-timestamp'],
        paths: { 'content[*].text': 'uuid' },
        ignore: ['meta.elapsedMs'],
        sortArrays: ['top'],
        record: {
          report: {
            cases: [{ case: 'default' }],
            paths: { 'items[*].id': 'hex-id' },
            sortArrays: ['items'],
            ignore: ['meta.debug'],
          },
        },
      },
    });
    if (!parsed.regression) {
      throw new Error('expected a regression block');
    }
    const golden = toGoldenConfig('2025-11-25', parsed.regression);
    expect(golden.defaultPaths).toEqual({ 'content[*].text': 'uuid' });
    expect(golden.defaultSortArrays).toEqual(['top']);
    expect(golden.defaultIgnore).toEqual(['meta.elapsedMs']);
    expect(golden.tools['report']?.paths).toEqual({ 'items[*].id': 'hex-id' });
    expect(golden.tools['report']?.sortArrays).toEqual(['items']);
    expect(golden.tools['report']?.ignore).toEqual(['meta.debug']);
  });

  it('backward compat: a config without the new options maps to empty defaults', () => {
    const parsed = configSchema.parse({
      target: { transport: 'stdio', command: 'node' },
      regression: {
        normalizers: ['uuid'],
        record: { echo: { cases: [{ case: 'basic', arguments: { text: 'hi' } }] } },
      },
    });
    if (!parsed.regression) {
      throw new Error('expected a regression block');
    }
    const golden = toGoldenConfig('2025-11-25', parsed.regression);
    expect(golden).toEqual({
      specVersion: '2025-11-25',
      defaultNormalizers: ['uuid'],
      defaultPaths: {},
      defaultSortArrays: [],
      defaultIgnore: [],
      tools: {
        echo: {
          cases: [{ case: 'basic', arguments: { text: 'hi' } }],
          normalizers: undefined,
          paths: undefined,
          sortArrays: undefined,
          ignore: undefined,
        },
      },
    });
  });
});
