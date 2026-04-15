import telegramify from 'telegramify-markdown';

const HR_PLACEHOLDER = 'XHRPLACEHOLDERX';

export function telegramifyMarkdown(content: string): string {
  if (!content) return '';

  // Protect horizontal rules from being removed
  const hrPattern = /^[ \t]*([-*_])\1{2,}[ \t]*$/gm;
  const withPlaceholders = content.replace(hrPattern, HR_PLACEHOLDER);

  // Process with 'remove' strategy (strips unsupported elements)
  const processed = telegramify(withPlaceholders, 'remove');

  // Restore horizontal rules as escaped dashes
  return processed.replace(new RegExp(HR_PLACEHOLDER, 'g'), '\\-\\-\\-');
}
