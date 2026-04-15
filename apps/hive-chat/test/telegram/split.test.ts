import { describe, it, expect } from 'vitest';
import { splitMessage } from '../../src/telegram/split.js';

describe('splitMessage', () => {
  it('returns single-element array for message under limit', () => {
    const msg = 'Hello world';
    expect(splitMessage(msg, 4096)).toEqual([msg]);
  });

  it('returns single-element array for message exactly at limit', () => {
    const msg = 'a'.repeat(4096);
    expect(splitMessage(msg, 4096)).toEqual([msg]);
  });

  it('splits at line breaks when possible', () => {
    const line = 'a'.repeat(100);
    const msg = Array(50).fill(line).join('\n'); // ~5049 chars with newlines
    const chunks = splitMessage(msg, 4096);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(4096);
    }
  });

  it('reassembles to original content when split at newlines', () => {
    const lines = Array.from({ length: 50 }, (_, i) => `Line ${i}: ${'x'.repeat(80)}`);
    const msg = lines.join('\n');
    const chunks = splitMessage(msg, 4096);

    expect(chunks.join('\n')).toBe(msg);
  });

  it('hard-splits when no line breaks exist', () => {
    const msg = 'a'.repeat(8000);
    const chunks = splitMessage(msg, 4096);

    expect(chunks.length).toBe(2);
    expect(chunks[0].length).toBe(4096);
    expect(chunks[1].length).toBe(3904);
    expect(chunks.join('')).toBe(msg);
  });

  it('handles exactly two chunks worth of content', () => {
    const msg = 'a'.repeat(4096) + 'b'.repeat(4096);
    const chunks = splitMessage(msg, 4096);
    expect(chunks.length).toBe(2);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(4096);
    }
  });

  it('uses custom maxLength', () => {
    const msg = 'hello world';
    const chunks = splitMessage(msg, 5);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(5);
    }
  });
});
