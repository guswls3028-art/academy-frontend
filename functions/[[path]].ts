// Cloudflare Pages Function: 테넌트 도메인 접속 시
// HTML 문서의 <title> / og:title / og:description / og:image / og:url 등을 브랜드명으로 치환.
// 카카오톡 등 크롤러는 JS를 실행하지 않으므로, 서버에서 내려줄 때부터 올바른 값이 필요함.
//
// 배포: index.html과 /assets/* 청크는 반드시 동일 빌드에서 함께 업로드되어야 함.
// 청크 해시가 바뀌면 이전 빌드의 index.html이 이전 청크를 요청해 404 → HTML 반환 시 MIME 오류 발생.

interface Env {
  ASSETS: Fetcher;
}

const STATIC_EXT = /\.(js|mjs|css|png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|eot|map|json|xml|txt|webmanifest)(\?.*)?$/i;

/** 정적 요청 404 시 HTML 대신 적절한 Content-Type으로 응답 (MIME type 오류 방지) */
function contentTypeForPath(pathname: string): string {
  if (/\.(js|mjs)(\?.*)?$/i.test(pathname)) return "application/javascript; charset=utf-8";
  if (/\.css(\?.*)?$/i.test(pathname)) return "text/css; charset=utf-8";
  if (/\.json(\?.*)?$/i.test(pathname)) return "application/json";
  return "application/octet-stream";
}

/** 테넌트별 OG 메타 */
interface TenantMeta {
  title: string;
  description: string;
  favicon?: string;
  image?: string;
}

/** 하드코딩 폴백 — API 장애 시 사용 */
const FALLBACK_META: Record<string, TenantMeta> = {
  "tchul.com":          { title: "박철과학",  description: "박철과학 학습 플랫폼 – 학생·선생님 로그인", favicon: "/tenants/tchul/favicon.png", image: "/tenants/tchul/logo-full.png" },
  "www.tchul.com":      { title: "박철과학",  description: "박철과학 학습 플랫폼 – 학생·선생님 로그인", favicon: "/tenants/tchul/favicon.png", image: "/tenants/tchul/logo-full.png" },
  "ymath.co.kr":        { title: "Y_math",     description: "Y_math 학습 플랫폼", favicon: "/tenants/ymath/favicon.png", image: "/tenants/ymath/og-image.png" },
  "www.ymath.co.kr":    { title: "Y_math",     description: "Y_math 학습 플랫폼", favicon: "/tenants/ymath/favicon.png", image: "/tenants/ymath/og-image.png" },
  "limglish.kr":        { title: "limglish",   description: "limglish 학습 플랫폼" },
  "www.limglish.kr":    { title: "limglish",   description: "limglish 학습 플랫폼" },
  "hakwonplus.com":     { title: "학원플러스",  description: "학원플러스 – 학원 관리·학생 학습 플랫폼" },
  "www.hakwonplus.com": { title: "학원플러스",  description: "학원플러스 – 학원 관리·학생 학습 플랫폼" },
  "sswe.co.kr":         { title: "sswe.co.kr", description: "sswe.co.kr 학습 플랫폼" },
  "www.sswe.co.kr":     { title: "sswe.co.kr", description: "sswe.co.kr 학습 플랫폼" },
};

const API_BASE = "https://api.hakwonplus.com";
const OG_CACHE_TTL = 300_000; // 5분
const ogCache: Record<string, { data: TenantMeta; ts: number }> = {};

/** 백엔드 API에서 테넌트 OG 데이터 가져오기 (5분 캐시) */
async function fetchOgMeta(host: string): Promise<TenantMeta | null> {
  const cached = ogCache[host];
  if (cached && Date.now() - cached.ts < OG_CACHE_TTL) return cached.data;

  try {
    const res = await fetch(`${API_BASE}/api/v1/core/og-meta/?hostname=${encodeURIComponent(host)}`, {
      headers: { "Accept": "application/json" },
      cf: { cacheTtl: 300 } as RequestInitCfProperties,
    });
    if (!res.ok) return null;
    const json = await res.json() as { title?: string; description?: string; image?: string };
    if (!json.title) return null;
    const meta: TenantMeta = {
      title: json.title,
      description: json.description || `${json.title} 학습 플랫폼`,
      image: json.image || undefined,
    };
    ogCache[host] = { data: meta, ts: Date.now() };
    return meta;
  } catch {
    return null;
  }
}

function injectMeta(html: string, meta: TenantMeta, origin: string): string {
  const { title, description, favicon, image } = meta;

  // <title>
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);

  // og:site_name, og:title, og:description
  html = html.replace(
    /<meta property="og:site_name" content="[^"]*" \/>/,
    `<meta property="og:site_name" content="${title}" />`,
  );
  html = html.replace(
    /<meta property="og:title" content="[^"]*" \/>/,
    `<meta property="og:title" content="${title}" />`,
  );
  html = html.replace(
    /<meta property="og:description" content="[^"]*" \/>/,
    `<meta property="og:description" content="${description}" />`,
  );

  // og:url — 현재 페이지 origin
  html = html.replace(
    /<meta property="og:url" content="[^"]*" \/>/,
    `<meta property="og:url" content="${origin}" />`,
  );

  // og:image
  if (image) {
    const absImage = origin + image;
    html = html.replace(
      /<meta property="og:image" content="[^"]*" \/>/,
      `<meta property="og:image" content="${absImage}" />`,
    );
    html = html.replace(
      /<meta name="twitter:image" content="[^"]*" \/>/,
      `<meta name="twitter:image" content="${absImage}" />`,
    );
  }

  // twitter:title, twitter:description
  html = html.replace(
    /<meta name="twitter:title" content="[^"]*" \/>/,
    `<meta name="twitter:title" content="${title}" />`,
  );
  html = html.replace(
    /<meta name="twitter:description" content="[^"]*" \/>/,
    `<meta name="twitter:description" content="${description}" />`,
  );

  // favicon
  if (favicon) {
    html = html.replace(
      /<link rel="icon" href="[^"]*"[^>]*>/,
      `<link rel="icon" href="${favicon}" type="image/png" />`,
    );
  }

  return html;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const pathname = url.pathname;
  const host = url.hostname.toLowerCase();
  const accept = context.request.headers.get("Accept") ?? "";

  // 정적 파일은 그대로 ASSETS에 위임
  if (STATIC_EXT.test(pathname)) {
    const res = await context.env.ASSETS.fetch(context.request);
    const ct = res.headers.get("Content-Type") ?? "";
    // 404이거나 200인데 HTML(SPA 폴백)이 오면 → MIME 오류 방지로 404 + 올바른 Content-Type 반환
    if (ct.includes("text/html")) {
      return new Response("/* 404 Not Found */", {
        status: 404,
        headers: { "Content-Type": contentTypeForPath(pathname) },
      });
    }
    return res;
  }

  // 크롤러(카카오톡 등)는 Accept: */* 로 요청할 수 있으므로,
  // 정적 파일이 아닌 모든 경로는 SPA index.html + 메타 치환으로 처리.
  // Accept 헤더와 무관하게 ASSETS에서 먼저 시도하고, HTML이 아닌 실제 에셋이면 그대로 반환.
  const assetRes = await context.env.ASSETS.fetch(context.request);
  const assetCt = assetRes.headers.get("Content-Type") ?? "";

  // ASSETS가 실제 비-HTML 파일을 반환하면 그대로 위임 (예: /favicon.ico 등)
  if (assetRes.status === 200 && !assetCt.includes("text/html")) {
    return assetRes;
  }

  // index.html 가져오기 (SPA 루트)
  const indexUrl = new URL(context.request.url);
  indexUrl.pathname = "/index.html";
  const res = await context.env.ASSETS.fetch(new Request(indexUrl));

  if (res.status !== 200) {
    return res;
  }

  const ct = res.headers.get("Content-Type") ?? "";
  if (!ct.includes("text/html")) {
    return res;
  }

  let html = await res.text();

  // 테넌트별 메타 치환 — API 우선, 폴백은 하드코딩
  const apiMeta = await fetchOgMeta(host);
  const meta = apiMeta || FALLBACK_META[host];
  if (meta) {
    const origin = url.origin;
    html = injectMeta(html, meta, origin);
  }

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": res.headers.get("Cache-Control") ?? "no-cache",
    },
  });
};
