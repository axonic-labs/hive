import { describe, it, expect, vi } from 'vitest';
import { generateResponse } from '../../src/llm/generate.js';

vi.mock('ai', () => ({
  generateText: vi.fn().mockResolvedValue({
    text: 'mocked response',
    usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
  }),
  stepCountIs: vi.fn().mockReturnValue('mock-stop-condition'),
}));

vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: vi.fn().mockReturnValue(
    vi.fn().mockReturnValue('mock-model'),
  ),
}));

describe('generateResponse', () => {
  it('returns text from generateText', async () => {
    const result = await generateResponse({
      systemPrompt: 'You are Elias.',
      messages: [{ role: 'user', content: 'hello' }],
      tools: {},
      apiKey: 'test-key',
    });

    expect(result.text).toBe('mocked response');
  });
});
