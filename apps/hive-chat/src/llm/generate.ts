import { generateText, stepCountIs, type ToolSet, type ModelMessage } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

const MODEL_ID = 'gemini-3.1-pro-preview';

interface GenerateInput {
  systemPrompt: string;
  messages: ModelMessage[];
  tools: ToolSet;
  apiKey: string;
}

interface GenerateOutput {
  text: string;
  usage: { inputTokens: number; outputTokens: number };
}

export async function generateResponse(input: GenerateInput): Promise<GenerateOutput> {
  const google = createGoogleGenerativeAI({ apiKey: input.apiKey });
  const model = google(MODEL_ID);

  const { text, usage } = await generateText({
    model,
    system: input.systemPrompt,
    messages: input.messages,
    tools: input.tools,
    stopWhen: stepCountIs(10),
  });

  return {
    text: text || '(no response)',
    usage: {
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
    },
  };
}
