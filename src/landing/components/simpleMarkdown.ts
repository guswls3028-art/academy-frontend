// PATH: src/landing/components/simpleMarkdown.ts
// 학생/staff 글쓰기에 가벼운 markdown → HTML 변환.
// backend sanitize_html이 위험 태그/속성 차단 — 이 변환은 최종 안전망 아님.
// 외부 라이브러리 의존성 회피(번들 사이즈 + 보안 audit 비용).
//
// 지원: **bold** / *italic* / ~~strike~~ / [text](url) / ![alt](url) / heading ## / list - / blockquote >
// 줄바꿈 자동 <br>.

const URL_RE = /^https?:\/\/[\w.\-/?#=&%+~:;@,!$'()*+,;=]+$/i;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function safeUrl(raw: string): string | null {
  const url = raw.trim();
  if (URL_RE.test(url)) return url;
  return null;
}

export function simpleMarkdownToHtml(md: string): string {
  if (!md) return "";
  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  let inList = false;

  for (let line of lines) {
    // 빈 줄
    if (!line.trim()) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push("");
      continue;
    }

    // heading ## H2 / ### H3 (h1은 글 제목과 충돌 회피 — 미지원)
    const h3 = line.match(/^###\s+(.+)$/);
    const h2 = line.match(/^##\s+(.+)$/);
    if (h3) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h3>${inline(h3[1])}</h3>`);
      continue;
    }
    if (h2) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h2>${inline(h2[1])}</h2>`);
      continue;
    }

    // list
    const li = line.match(/^[-*]\s+(.+)$/);
    if (li) {
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push(`<li>${inline(li[1])}</li>`);
      continue;
    }

    // blockquote
    const bq = line.match(/^>\s+(.+)$/);
    if (bq) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<blockquote>${inline(bq[1])}</blockquote>`);
      continue;
    }

    if (inList) { out.push("</ul>"); inList = false; }
    out.push(`<p>${inline(line)}</p>`);
  }
  if (inList) out.push("</ul>");
  return out.join("\n");
}

function inline(s: string): string {
  let r = escapeHtml(s);
  // image ![alt](url) — url 검증
  r = r.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt: string, raw: string) => {
    const url = safeUrl(raw);
    if (!url) return `[${escapeHtml(alt)}](${escapeHtml(raw)})`;
    return `<img src="${url}" alt="${escapeHtml(alt)}" />`;
  });
  // link [text](url)
  r = r.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, text: string, raw: string) => {
    const url = safeUrl(raw);
    if (!url) return `[${escapeHtml(text)}](${escapeHtml(raw)})`;
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`;
  });
  // bold **x**
  r = r.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // italic *x* (단, **bold** 이미 처리됨)
  r = r.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1<em>$2</em>");
  // strike ~~x~~
  r = r.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  // inline code `x`
  r = r.replace(/`([^`]+)`/g, "<code>$1</code>");
  return r;
}
