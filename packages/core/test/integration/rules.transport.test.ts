import { describe, expect, it } from 'vitest';
import { httpSessionIdValid } from '../../src/rules/2025-11-25/index';
import { compliantFixture, runRule } from '../support/harness';

describe('transport/http-session-id-valid (fixture pair)', () => {
  it('passes: compliant HTTP server issues a UUID session id', async () => {
    const fixture = await compliantFixture('http');
    try {
      expect((await runRule(httpSessionIdValid, fixture.target)).status).toBe('pass');
    } finally {
      await fixture.stop();
    }
  });

  it('fails: HTTP session id contains a space (outside visible ASCII)', async () => {
    const fixture = await compliantFixture('http', ['--http-defect', 'bad-session-id']);
    try {
      expect((await runRule(httpSessionIdValid, fixture.target)).status).toBe('fail');
    } finally {
      await fixture.stop();
    }
  });

  it('skips: stdio has no HTTP session', async () => {
    const fixture = await compliantFixture('stdio');
    try {
      expect((await runRule(httpSessionIdValid, fixture.target)).status).toBe('skip');
    } finally {
      await fixture.stop();
    }
  });
});
