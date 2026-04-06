import { generateText, stepCountIs, type ToolSet } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { getAgentConfig, getLLMConfig, getUserById } from '../config/manager.js';
import { generateAgentTools } from './tools.js';
import type { AgentRunSummary } from '@hive/shared';

const runningAgents = new Map<string, AbortController>();

function getBaseUrl(): string {
  return process.env.HIVE_INTERNAL_URL || `http://localhost:${process.env.PORT || 3000}`;
}

function createModel(provider: string, apiKey: string, model: string) {
  if (provider === 'openai') {
    return createOpenAI({ apiKey })(model);
  }
  return createAnthropic({ apiKey })(model);
}

async function logToThread(baseUrl: string, agentApiKey: string, space: string, thread: string, author: string, content: string) {
  try {
    await fetch(`${baseUrl}/api/data/${space}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${agentApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ thread, author: 'system', content, source: author }),
    });
  } catch {
    // logging failure shouldn't crash the agent
  }
}

export function isAgentRunning(name: string): boolean {
  return runningAgents.has(name);
}

export async function executeAgent(name: string): Promise<AgentRunSummary> {
  const startedAt = new Date();
  const config = getAgentConfig(name);
  if (!config) throw new Error(`Agent "${name}" not found`);
  if (!config.enabled) throw new Error(`Agent "${name}" is disabled`);

  const llmConfig = getLLMConfig();
  if (!llmConfig) throw new Error('LLM not configured');

  const user = getUserById(config.user_id);
  if (!user) throw new Error(`Agent user not found`);

  if (runningAgents.has(name)) {
    throw new Error(`Agent "${name}" is already running`);
  }

  const abortController = new AbortController();
  runningAgents.set(name, abortController);

  const baseUrl = getBaseUrl();
  const model = createModel(llmConfig.provider, llmConfig.api_key, config.model || llmConfig.default_model);
  const tools = generateAgentTools(config.user_id, baseUrl, user.api_key);
  const threadName = `${config.log_thread_prefix}/${startedAt.toISOString().slice(0, 10)}`;

  let status: 'success' | 'error' | 'timeout' = 'success';

  try {
    await logToThread(baseUrl, user.api_key, config.log_space, threadName, name, `▶ Agent run started`);

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('timeout')), config.timeout_ms);
    });

    const result = await Promise.race([
      generateText({
        model,
        system: config.prompt,
        messages: [{ role: 'user' as const, content: 'Run your task now.' }],
        tools: tools as unknown as ToolSet,
        stopWhen: stepCountIs(25),
        abortSignal: abortController.signal,
      }),
      timeoutPromise,
    ]);

    const text = result.text || '(no text output)';
    const stepCount = result.steps?.length ?? 0;

    await logToThread(baseUrl, user.api_key, config.log_space, threadName, name,
      `✓ Completed in ${stepCount} steps\n\n${text}`);

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    status = msg === 'timeout' ? 'timeout' : 'error';
    await logToThread(baseUrl, user.api_key, config.log_space, threadName, name,
      `✗ ${status}: ${msg}`);
    console.error(`Agent "${name}" ${status}:`, msg);
  } finally {
    runningAgents.delete(name);
  }

  const durationMs = Date.now() - startedAt.getTime();

  return {
    thread: threadName,
    started_at: startedAt.toISOString(),
    status,
    duration_ms: durationMs,
  };
}
