const HTML_TAG_RE = /<\/?[a-z][\s\S]*>/i;
const SCRIPT_STYLE_RE = /<(script|style)\b[\s\S]*?<\/\1>/gi;
const BR_RE = /<br\s*\/?>/gi;
const BLOCK_END_RE = /<\/(p|div|h[1-6]|li|blockquote|pre|tr|table)>/gi;
const LI_START_RE = /<li\b[^>]*>/gi;
const HTML_ENTITY_RE = /&(?:[a-z][a-z0-9]+|#\d+|#x[\da-f]+);/i;

export function isRichHtml(value: string | null | undefined): boolean {
  return !!value && HTML_TAG_RE.test(normalizeRichHtmlInput(value));
}

function decodeHtmlFallback(value: string): string {
  return value
    .replace(/&#x([\da-f]+);/gi, (_, hex: string) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    })
    .replace(/&#(\d+);/g, (_, dec: string) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    })
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'");
}

function decodeHtmlEntitiesOnce(value: string): string {
  if (!HTML_ENTITY_RE.test(value)) return value;

  if (typeof document !== "undefined") {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = value;
    return textarea.value;
  }

  return decodeHtmlFallback(value);
}

function decodeHtmlEntities(value: string): string {
  let decoded = value;
  for (let i = 0; i < 2; i += 1) {
    const next = decodeHtmlEntitiesOnce(decoded);
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
}

export function normalizeRichHtmlInput(value: string | null | undefined): string {
  if (!value) return "";
  return decodeHtmlEntities(value);
}

export function richHtmlToPlainText(value: string | null | undefined): string {
  if (!value) return "";

  const withLineBreaks = normalizeRichHtmlInput(value)
    .replace(SCRIPT_STYLE_RE, "")
    .replace(BR_RE, "\n")
    .replace(LI_START_RE, "\n")
    .replace(BLOCK_END_RE, "\n");

  let text = "";
  if (typeof document !== "undefined") {
    const div = document.createElement("div");
    div.innerHTML = withLineBreaks;
    text = div.textContent || div.innerText || "";
  } else {
    text = decodeHtmlFallback(withLineBreaks.replace(/<[^>]*>/g, ""));
  }

  return text
    .replace(/\u00a0/g, " ")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function richHtmlToPreviewText(value: string | null | undefined, maxLength = 80): string {
  const text = richHtmlToPlainText(value).replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}
