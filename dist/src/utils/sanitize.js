"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeUrl = exports.sanitizeReviewComment = exports.sanitizeSearchQuery = exports.sanitizeNullableText = exports.sanitizeText = exports.removeDangerousCharacters = exports.escapeHtml = void 0;
const htmlEscapeMap = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
    "`": "&#96;",
    "/": "&#x2F;",
};
const escapeHtml = (value) => {
    return value.replace(/[&<>"'`/]/g, (char) => htmlEscapeMap[char]);
};
exports.escapeHtml = escapeHtml;
const removeDangerousCharacters = (value, allowNewLines = true) => {
    let cleaned = value.replace(/\0/g, "");
    if (allowNewLines) {
        cleaned = cleaned.replace(/[^\S\r\n\t ]+/g, " ");
    }
    else {
        cleaned = cleaned.replace(/\s+/g, " ");
    }
    return cleaned;
};
exports.removeDangerousCharacters = removeDangerousCharacters;
const sanitizeText = (value, options = {}) => {
    const { maxLength = 1000, trim = true, allowNewLines = true } = options;
    if (value === null || value === undefined) {
        return "";
    }
    let text = String(value);
    text = (0, exports.removeDangerousCharacters)(text, allowNewLines);
    if (trim) {
        text = text.trim();
    }
    if (text.length > maxLength) {
        text = text.slice(0, maxLength);
    }
    return (0, exports.escapeHtml)(text);
};
exports.sanitizeText = sanitizeText;
const sanitizeNullableText = (value, options = {}) => {
    const sanitized = (0, exports.sanitizeText)(value, options);
    if (!sanitized) {
        return null;
    }
    return sanitized;
};
exports.sanitizeNullableText = sanitizeNullableText;
const sanitizeSearchQuery = (value) => {
    return (0, exports.sanitizeText)(value, {
        maxLength: 100,
        trim: true,
        allowNewLines: false,
    });
};
exports.sanitizeSearchQuery = sanitizeSearchQuery;
const sanitizeReviewComment = (value) => {
    return (0, exports.sanitizeNullableText)(value, {
        maxLength: 1000,
        trim: true,
        allowNewLines: true,
    });
};
exports.sanitizeReviewComment = sanitizeReviewComment;
/**
 * Khusus untuk URL seperti imageUrl, logoUrl, atau link eksternal.
 *
 * Penting:
 * - Jangan pakai sanitizeText untuk URL.
 * - sanitizeText akan mengubah "/" menjadi "&#x2F;" dan "&" menjadi "&amp;".
 * - URL cukup di-trim dan divalidasi protocol-nya.
 */
const sanitizeUrl = (value, options = {}) => {
    const { maxLength = 1000, allowedProtocols = ["http:", "https:"], } = options;
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
    }
    catch {
        return null;
    }
};
exports.sanitizeUrl = sanitizeUrl;
