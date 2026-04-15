import type { Telegram } from 'telegraf';
import type { HiveClient } from '../hive/client.js';
import type { ChatMessage } from '../hive/types.js';
import type { ModelMessage } from 'ai';
import { generateResponse } from '../llm/generate.js';
import { createTools } from '../llm/tools.js';
import { buildSystemPrompt } from '../llm/system-prompt.js';
import { sendResponse, sendProvisional } from '../telegram/send.js';

export interface HandlerDeps {
  hive: HiveClient;
  telegram: Telegram;
  geminiApiKey: string;
  chatSpace: string;
  notesSpace: string;
  chatThread: string;
  anchorFile: string;
  contextMessageCount: number;
}

function toAIMessages(messages: ChatMessage[]): ModelMessage[] {
  return messages.map((m) => ({
    role: m.author === 'user' ? 'user' as const : 'assistant' as const,
    content: m.content,
  }));
}

export async function handleTextMessage(deps: HandlerDeps, chatId: number, text: string): Promise<void> {
  const { hive, telegram, geminiApiKey, chatSpace, notesSpace, chatThread, anchorFile, contextMessageCount } = deps;

  // Store user message
  try {
    await hive.postMessage(chatSpace, {
      thread: chatThread,
      author: 'user',
      content: text,
      source: 'telegram',
    });
  } catch (err) {
    console.error('Failed to store user message in Hive:', err);
  }

  // Send typing indicator
  try {
    await telegram.sendChatAction(chatId, 'typing');
  } catch {
    // Non-critical
  }

  // Fetch context
  let recentMessages: ChatMessage[] = [];
  let anchorContent: string | null = null;

  try {
    [recentMessages, anchorContent] = await Promise.all([
      hive.getRecentMessages(chatSpace, chatThread, contextMessageCount),
      hive.readFile(notesSpace, anchorFile),
    ]);
  } catch (err) {
    console.error('Failed to fetch context from Hive:', err);
    await telegram.sendMessage(chatId, "Having trouble reaching my memory right now. I'll respond without full context.");
  }

  // Build messages — use history if available, otherwise just current message
  const aiMessages = recentMessages.length > 0
    ? toAIMessages(recentMessages)
    : [{ role: 'user' as const, content: text }];

  // Build tools and system prompt
  const tools = createTools(hive, notesSpace, chatSpace);
  const systemPrompt = buildSystemPrompt(anchorContent);

  // Send provisional "thinking" message
  let provisionalId: number | undefined;
  try {
    provisionalId = await sendProvisional(telegram, chatId, 'Let me think about that...');
  } catch {
    // Non-critical
  }

  // Generate response
  try {
    const result = await generateResponse({
      systemPrompt,
      messages: aiMessages,
      tools,
      apiKey: geminiApiKey,
    });

    // Delete provisional message
    if (provisionalId) {
      try { await telegram.deleteMessage(chatId, provisionalId); } catch {}
    }

    // Send real response
    await sendResponse(telegram, chatId, result.text);

    // Store assistant response
    try {
      await hive.postMessage(chatSpace, {
        thread: chatThread,
        author: 'assistant',
        content: result.text,
      });
    } catch (err) {
      console.error('Failed to store assistant response in Hive:', err);
    }
  } catch (err) {
    console.error('LLM generation failed:', err);

    if (provisionalId) {
      try { await telegram.deleteMessage(chatId, provisionalId); } catch {}
    }
    await telegram.sendMessage(chatId, 'Sorry, had trouble generating a response. Try again?');
  }
}

export async function handleVoiceMessage(deps: HandlerDeps, chatId: number, _fileId: string): Promise<void> {
  await deps.telegram.sendMessage(chatId, 'Voice messages are not supported yet — text me instead.');
}
