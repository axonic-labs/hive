function required(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

function parseContactMap(raw: string): Map<number, string> {
  const map = new Map<number, string>();
  for (const entry of raw.split(',')) {
    const [chatId, contact] = entry.trim().split(':');
    if (chatId && contact) {
      map.set(Number(chatId), contact);
    }
  }
  if (map.size === 0) throw new Error('TELEGRAM_CONTACT_MAP must contain at least one chatId:contact entry');
  return map;
}

export const config = {
  telegramBotToken: required('TELEGRAM_BOT_TOKEN'),
  hiveApiUrl: required('HIVE_API_URL'),
  hiveApiKey: required('HIVE_API_KEY'),
  geminiApiKey: required('GEMINI_API_KEY'),
  webhookUrl: required('WEBHOOK_URL'),
  webhookSecret: required('WEBHOOK_SECRET'),
  contactMap: parseContactMap(required('TELEGRAM_CONTACT_MAP')),
  port: parseInt(process.env.PORT || '3000', 10),

  // Hardcoded space names (MVP)
  chatSpace: 'diary',
  notesSpace: 'notes',
  chatThread: 'hive-chat',
  anchorFile: 'elias.md',
  contextMessageCount: 30,
};
