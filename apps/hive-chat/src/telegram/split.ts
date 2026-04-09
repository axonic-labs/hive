export function splitMessage(message: string, maxLength = 4096): string[] {
  if (message.length <= maxLength) return [message];

  const chunks: string[] = [];
  let remaining = message;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    let splitIndex = remaining.substring(0, maxLength).lastIndexOf('\n');

    if (splitIndex <= 0) {
      splitIndex = maxLength;
      chunks.push(remaining.substring(0, splitIndex));
      remaining = remaining.substring(splitIndex);
    } else {
      chunks.push(remaining.substring(0, splitIndex));
      remaining = remaining.substring(splitIndex + 1);
    }
  }

  return chunks;
}
