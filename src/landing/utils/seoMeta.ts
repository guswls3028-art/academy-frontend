// PATH: src/landing/utils/seoMeta.ts
// 랜딩 페이지 SEO meta tag 동적 setter SSOT (2026-05-12 정합).
//
// 이전엔 LandingShareReportPage / LandingReportDetailPage / LandingCommunityPostPage /
// PublicLandingPage 4곳에 `function setMeta` (또는 `setMetaTag`) 중복 정의. 동일 로직.
// 한 곳에서 export → 호출처는 import.

/**
 * head 안에 name="..." (또는 property="og:..." for og 태그) 동적 set.
 * 기존 태그 있으면 content 업데이트, 없으면 createElement + appendChild.
 *
 * og 검출: name 이 "og:" 로 시작하면 property 사용 (Open Graph spec).
 */
export function setLandingMeta(name: string, content: string): void {
  const isOg = name.startsWith("og:");
  const sel = isOg ? `meta[property="${name}"]` : `meta[name="${name}"]`;
  let el = document.querySelector(sel) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    if (isOg) el.setAttribute("property", name);
    else el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}
