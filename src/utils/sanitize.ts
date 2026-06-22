type SanitizeOptions = {
  maxLength?: number;
  trim?: boolean;
  allowNewLines?: boolean;
};

type SanitizeUrlOptions = {
  maxLength?: number;
  allowedProtocols?: string[];
};

const htmlEscapeMap: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
  "`": "&#96;",
  "/": "&#x2F;",
};

export const escapeHtml = (value: string): string => {
  return value.replace(/[&<>"'`/]/g, (char) => htmlEscapeMap[char]);
};

export const removeDangerousCharacters = (
  value: string,
  allowNewLines = true
): string => {
  let cleaned = value.replace(/\0/g, "");

  if (allowNewLines) {
    cleaned = cleaned.replace(/[^\S\r\n\t ]+/g, " ");
  } else {
    cleaned = cleaned.replace(/\s+/g, " ");
  }

  return cleaned;
};

export const sanitizeText = (
  value: unknown,
  options: SanitizeOptions = {}
): string => {
  const { maxLength = 1000, trim = true, allowNewLines = true } = options;

  if (value === null || value === undefined) {
    return "";
  }

  let text = String(value);

  text = removeDangerousCharacters(text, allowNewLines);

  if (trim) {
    text = text.trim();
  }

  if (text.length > maxLength) {
    text = text.slice(0, maxLength);
  }

  return escapeHtml(text);
};

export const sanitizeNullableText = (
  value: unknown,
  options: SanitizeOptions = {}
): string | null => {
  const sanitized = sanitizeText(value, options);

  if (!sanitized) {
    return null;
  }

  return sanitized;
};

export const sanitizeSearchQuery = (value: unknown): string => {
  return sanitizeText(value, {
    maxLength: 100,
    trim: true,
    allowNewLines: false,
  });
};

export const sanitizeReviewComment = (value: unknown): string | null => {
  return sanitizeNullableText(value, {
    maxLength: 1000,
    trim: true,
    allowNewLines: true,
  });
};

/**
 * Khusus untuk URL seperti imageUrl, logoUrl, atau link eksternal.
 *
 * Penting:
 * - Jangan pakai sanitizeText untuk URL.
 * - sanitizeText akan mengubah "/" menjadi "&#x2F;" dan "&" menjadi "&amp;".
 * - URL cukup di-trim dan divalidasi protocol-nya.
 */
export const sanitizeUrl = (
  value: unknown,
  options: SanitizeUrlOptions = {}
): string | null => {
  const {
    maxLength = 1000,
    allowedProtocols = ["http:", "https:"],
  } = options;

  if (value === null || value === undefined) {
    return null;
  }

  const url = String(value).trim();

  if (!url) {
    return null;
  }

  if (url.length > maxLength) {
    return null;
  }

  try {
    const parsedUrl = new URL(url);

    if (!allowedProtocols.includes(parsedUrl.protocol)) {
      return null;
    }

    return parsedUrl.toString();
  } catch {
    return null;
  }
};