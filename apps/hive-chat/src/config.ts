function required(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

export const config = {
  telegramBotToken: required('TELEGRAM_BOT_TOKEN'),
  hiveApiUrl: required('HIVE_API_URL'),
  hiveApiKey: required('HIVE_API_KEY'),
  geminiApiKey: required('GEMINI_API_KEY'),
  webhookUrl: required('WEBHOOK_URL'),
  webhookSecret: process.env.WEBHOOK_SECRET || 'elias-webhook',
  port: parseInt(process.env.PORT || '3000', 10),

  // Hardcoded space names (MVP)
  chatSpace: 'diary',
  notesSpace: 'notes',
  chatThread: 'hive-chat',
  anchorFile: 'elias.md',
  contextMessageCount: 30,
} as const;
