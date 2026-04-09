import { describe, it, expect } from 'vitest';
import { telegramifyMarkdown } from '../../src/telegram/markdown.js';

describe('telegramifyMarkdown', () => {
  it('converts markdown to MarkdownV2 without throwing', () => {
    const result = telegramifyMarkdown('Hello **world**');
    expect(typeof result).toBe('string');
  });

  it('returns a non-empty string for basic markdown', () => {
    const result = telegramifyMarkdown('Hello **world**');
    expect(result.length).toBeGreaterThan(0);
  });

  it('preserves horizontal rules as \\-\\-\\-', () => {
    const result = telegramifyMarkdown('before\n\n---\n\nafter');
    expect(result).toContain('\\-\\-\\-');
  });

  it('handles dashes horizontal rules (---)' , () => {
    const result = telegramifyMarkdown('---');
    expect(result.trim()).toBe('\\-\\-\\-');
  });

  it('handles asterisk horizontal rules (***)', () => {
    const result = telegramifyMarkdown('***');
    expect(result).toContain('\\-\\-\\-');
  });

  it('handles underscore horizontal rules (___)', () => {
    const result = telegramifyMarkdown('___');
    expect(result).toContain('\\-\\-\\-');
  });

  it('handles empty input', () => {
    expect(telegramifyMarkdown('')).toBe('');
  });

  it('handles whitespace-only input', () => {
    const result = telegramifyMarkdown('   ');
    expect(typeof result).toBe('string');
  });
});
