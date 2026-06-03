const HTML_TAG_RE = /<\/?[a-z][\s\S]*>/i;
const SCRIPT_STYLE_RE = /<(script|style)\b[\s\S]*?<\/\1>/gi;
const BR_RE = /<br\s*\/?>/gi;
const BLOCK_END_RE = /<\/(p|div|h[1-6]|li|blockquote|pre|tr|table)>/gi;
const LI_START_RE = /<li\b[^>]*>/gi;

export function isRichHtml(value: string | null | undefined): boolean {
  return !!value && HTML_TAG_RE.test(value);
}

function decodeHtmlFallback(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'");
}

export function richHtmlToPlainText(value: string | null | undefined): string {
  if (!value) return "";

  const withLineBreaks = value
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
