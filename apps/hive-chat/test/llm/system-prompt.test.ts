import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from '../../src/llm/system-prompt.js';

describe('buildSystemPrompt', () => {
  it('includes anchor file content when provided', () => {
    const prompt = buildSystemPrompt('# Goals\n- Ship Elias');
    expect(prompt).toContain('# Goals');
    expect(prompt).toContain('Ship Elias');
  });

  it('handles null anchor file gracefully', () => {
    const prompt = buildSystemPrompt(null);
    expect(prompt).toContain('Elias');
    expect(prompt).not.toContain('null');
  });

  it('includes the thinking partner identity', () => {
    const prompt = buildSystemPrompt(null);
    expect(prompt).toMatch(/think|partner|push back/i);
  });

  it('includes macro/micro instruction', () => {
    const prompt = buildSystemPrompt(null);
    expect(prompt).toMatch(/macro|micro/i);
  });
});
