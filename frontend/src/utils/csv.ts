const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export interface ParseResult {
  valid: string[];
  invalidCount: number;
  totalTokens: number;
}

/**
 * Parses raw text content from CSV or TXT file and extracts unique valid email addresses.
 */
export function parseEmailFileContent(content: string): ParseResult {
  if (!content || !content.trim()) {
    return { valid: [], invalidCount: 0, totalTokens: 0 };
  }

  // Split by commas, newlines, semicolons, or whitespace
  const rawTokens = content
    .split(/[\r\n,;\s]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  const validSet = new Set<string>();
  let invalidCount = 0;

  for (const token of rawTokens) {
    // Strip leading/trailing quotes if present in CSV
    const cleaned = token.replace(/^["']|["']$/g, '').trim();
    if (!cleaned) continue;

    if (EMAIL_REGEX.test(cleaned)) {
      validSet.add(cleaned.toLowerCase());
    } else {
      invalidCount++;
    }
  }

  return {
    valid: Array.from(validSet),
    invalidCount,
    totalTokens: rawTokens.length,
  };
}
