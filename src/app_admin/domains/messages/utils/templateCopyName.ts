const COPY_PREFIX = "복사 - ";
const COPY_PREFIX_RE = /^(?:복사\s*-\s*)+/u;
const MAX_TEMPLATE_NAME_LENGTH = 120;

export function buildDuplicateTemplateName(name: string): string {
  const base = name.replace(COPY_PREFIX_RE, "").trim() || "새 문구";
  const maxBaseLength = MAX_TEMPLATE_NAME_LENGTH - [...COPY_PREFIX].length;
  return `${COPY_PREFIX}${[...base].slice(0, maxBaseLength).join("")}`;
}
