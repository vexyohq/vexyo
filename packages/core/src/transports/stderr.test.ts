import { describe, expect, it } from 'vitest';
import { createStderrTail, STDERR_CAP_BYTES } from './stderr';

describe('createStderrTail', () => {
  it('keeps everything under the cap, untruncated', () => {
    const tail = createStderrTail(100);
    tail.append('hello ');
    tail.append(Buffer.from('world\n'));
    expect(tail.snapshot()).toEqual({ text: 'hello world\n', truncated: false });
  });

  it('drops the OLDEST bytes once the cap is exceeded', () => {
    const tail = createStderrTail(10);
    tail.append('0123456789'); // exactly at cap
    tail.append('ABCDE'); // pushes 5 bytes out of the front
    expect(tail.snapshot()).toEqual({ text: '56789ABCDE', truncated: true });
  });

  it('trims across multiple chunks, splitting a chunk when needed', () => {
    const tail = createStderrTail(6);
    tail.append('aaa');
    tail.append('bbb');
    tail.append('cccc'); // total 10 → drop 'aaa' whole, then 1 byte of 'bbb'
    expect(tail.snapshot()).toEqual({ text: 'bbcccc', truncated: true });
  });

  it('a single oversized chunk keeps only its tail', () => {
    const tail = createStderrTail(4);
    tail.append('abcdefgh');
    expect(tail.snapshot()).toEqual({ text: 'efgh', truncated: true });
  });

  it('snapshot is idempotent and stays readable after more appends', () => {
    const tail = createStderrTail(8);
    tail.append('12345678');
    expect(tail.snapshot()).toEqual(tail.snapshot());
    tail.append('9');
    expect(tail.snapshot()).toEqual({ text: '23456789', truncated: true });
  });

  it('defaults to a 64KiB cap', () => {
    expect(STDERR_CAP_BYTES).toBe(64 * 1024);
    const tail = createStderrTail();
    tail.append(Buffer.alloc(STDERR_CAP_BYTES, 0x61));
    expect(tail.snapshot().truncated).toBe(false);
    tail.append('b');
    const snap = tail.snapshot();
    expect(snap.truncated).toBe(true);
    expect(snap.text.length).toBe(STDERR_CAP_BYTES);
    expect(snap.text.endsWith('b')).toBe(true);
  });
});
