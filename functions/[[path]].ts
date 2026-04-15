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
  imageWidth?: number;
  imageHeight?: number;
}

/** 이미지 경로 정규화: 상대 경로는 /로 시작하도록, 절대 URL은 그대로 반환 */
function normalizeImagePath(image: string): string {
  if (!image) return "";
  if (image.startsWith("http://") || image.startsWith("https://")) return image;
  return image.startsWith("/") ? image : "/" + image;
}

/** 테넌트별 사이트맵/SEO 설정. loginPath: 메인 로그인 경로, naver: 네이버 Search Advisor 인증 코드 */
interface TenantSeo {
  domain: string;
  loginPath: string;
  naver?: string; // naver-site-verification meta content
}

const TENANT_SEO: Record<string, TenantSeo> = {
  "hakwonplus.com":     { domain: "hakwonplus.com",     loginPath: "/promo",          naver: "d2824e05fff2abca6dcc15a69de142bf3c1064bb" },
  "www.hakwonplus.com": { domain: "hakwonplus.com",     loginPath: "/promo",          naver: "d2824e05fff2abca6dcc15a69de142bf3c1064bb" },
  "tchul.com":          { domain: "tchul.com",          loginPath: "/login/tchul",    naver: "c7939870eaa36955e7516638b8ac8677da75e30d" },
  "www.tchul.com":      { domain: "tchul.com",          loginPath: "/login/tchul",    naver: "c7939870eaa36955e7516638b8ac8677da75e30d" },
  "limglish.kr":        { domain: "limglish.kr",        loginPath: "/login/limglish", naver: "5d45bf4681371272637101e231d53c5e94fbe62e" },
  "www.limglish.kr":    { domain: "limglish.kr",        loginPath: "/login/limglish", naver: "5d45bf4681371272637101e231d53c5e94fbe62e" },
  "ymath.co.kr":        { domain: "ymath.co.kr",        loginPath: "/login/ymath",    naver: "e03517c8855c685ee7859cd49de1886f61807f81" },
  "www.ymath.co.kr":    { domain: "ymath.co.kr",        loginPath: "/login/ymath",    naver: "e03517c8855c685ee7859cd49de1886f61807f81" },
  "sswe.co.kr":         { domain: "sswe.co.kr",         loginPath: "/login/sswe",     naver: "a529d17f8008421019d65e13be1efda83f84b65c" },
  "www.sswe.co.kr":     { domain: "sswe.co.kr",         loginPath: "/login/sswe",     naver: "a529d17f8008421019d65e13be1efda83f84b65c" },
  "dnbacademy.co.kr":   { domain: "dnbacademy.co.kr",   loginPath: "/login/dnb",      naver: "63724ceef8ef97b665e728a3f1e601788af8e2d3" },
  "www.dnbacademy.co.kr": { domain: "dnbacademy.co.kr", loginPath: "/login/dnb",      naver: "63724ceef8ef97b665e728a3f1e601788af8e2d3" },
};

/** 네이버 Search Advisor HTML 파일 인증용 매핑 (도메인 → 인증 파일명) */
const NAVER_HTML_VERIFY: Record<string, string> = {
  "hakwonplus.com":     "navere58d27fb1be5a237409cd2afa105badf",
  "www.hakwonplus.com": "navere58d27fb1be5a237409cd2afa105badf",
  "tchul.com":          "naver074bf347ad90c08fae0b9c791cee4ecf",
  "www.tchul.com":      "naver074bf347ad90c08fae0b9c791cee4ecf",
  "limglish.kr":        "naver9740e279590adb84910985760fe05ff9",
  "www.limglish.kr":    "naver9740e279590adb84910985760fe05ff9",
  "ymath.co.kr":        "naver695ade48d0b47af9497f3a7112630c1e",
  "www.ymath.co.kr":    "naver695ade48d0b47af9497f3a7112630c1e",
  "sswe.co.kr":         "naverb15ee3063c6b2c218907df0835dfee5d",
  "www.sswe.co.kr":     "naverb15ee3063c6b2c218907df0835dfee5d",
  "dnbacademy.co.kr":   "naverecf2546ce8e867d0d40c2ec7ab686502",
  "www.dnbacademy.co.kr": "naverecf2546ce8e867d0d40c2ec7ab686502",
};

/** 테넌트별 동적 sitemap.xml 생성 — 네이버 등 검색엔진이 해당 도메인 URL만 수집하도록 */
function generateSitemap(host: string): string | null {
  const seo = TENANT_SEO[host];
  if (!seo) return null;
  const d = seo.domain;
  const base = `https://${d}`;
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    `  <url><loc>${base}${seo.loginPath}</loc><changefreq>monthly</changefreq><priority>1.0</priority></url>`,
    `  <url><loc>${base}/terms</loc><changefreq>yearly</changefreq><priority>0.3</priority></url>`,
    `  <url><loc>${base}/privacy</loc><changefreq>yearly</changefreq><priority>0.3</priority></url>`,
    '</urlset>',
  ].join("\n");
}

/** 테넌트별 동적 robots.txt 생성 */
function generateRobots(host: string): string {
  const seo = TENANT_SEO[host];
  const domain = seo?.domain ?? host;
  return [
    "User-agent: *",
    "Allow: /login",
    "Allow: /login/",
    "Allow: /promo",
    "Allow: /promo/",
    "Allow: /terms",
    "Allow: /privacy",
    "Disallow: /admin",
    "Disallow: /admin/",
    "Disallow: /student",
    "Disallow: /student/",
    "Disallow: /dev",
    "Disallow: /dev/",
    "Disallow: /api",
    "Disallow: /api/",
    "",
    `Sitemap: https://${domain}/sitemap.xml`,
    "",
  ].join("\n");
}

/** 하드코딩 폴백 — API 장애 시 사용. imageWidth/imageHeight는 카카오톡 크롤러 힌트용. */
const FALLBACK_META: Record<string, TenantMeta> = {
  "tchul.com":          { title: "박철 과학",  description: "박철 과학(tchul.com) – 대치동 과학 전문 학원. 생명과학·화학·물리·지구과학 학습 플랫폼", favicon: "/tenants/tchul/favicon.png", image: "/tenants/tchul/og-image.png", imageWidth: 800, imageHeight: 427 },
  "www.tchul.com":      { title: "박철 과학",  description: "박철 과학(tchul.com) – 대치동 과학 전문 학원. 생명과학·화학·물리·지구과학 학습 플랫폼", favicon: "/tenants/tchul/favicon.png", image: "/tenants/tchul/og-image.png", imageWidth: 800, imageHeight: 427 },
  "ymath.co.kr":        { title: "Y_math",     description: "Y_math 학습 플랫폼", favicon: "/tenants/ymath/favicon.png", image: "/tenants/ymath/og-image.png", imageWidth: 800, imageHeight: 420 },
  "www.ymath.co.kr":    { title: "Y_math",     description: "Y_math 학습 플랫폼", favicon: "/tenants/ymath/favicon.png", image: "/tenants/ymath/og-image.png", imageWidth: 800, imageHeight: 420 },
  "limglish.kr":        { title: "임근혁 영어", description: "임근혁 영어(limglish) – 영어 전문 학습 플랫폼. 학생·선생님 로그인", favicon: "/tenants/limglish/favicon.png", image: "/tenants/limglish/og-image.png", imageWidth: 800, imageHeight: 420 },
  "www.limglish.kr":    { title: "임근혁 영어", description: "임근혁 영어(limglish) – 영어 전문 학습 플랫폼. 학생·선생님 로그인", favicon: "/tenants/limglish/favicon.png", image: "/tenants/limglish/og-image.png", imageWidth: 800, imageHeight: 420 },
  "hakwonplus.com":     { title: "학원플러스",  description: "학원플러스 – 학원 관리·학생 학습 플랫폼" },
  "www.hakwonplus.com": { title: "학원플러스",  description: "학원플러스 – 학원 관리·학생 학습 플랫폼" },
  "sswe.co.kr":         { title: "SSWE", description: "SSWE 학습 플랫폼 – 학생·선생님 로그인", favicon: "/tenants/sswe/favicon.png", image: "/tenants/sswe/logo-full.png", imageWidth: 800, imageHeight: 380 },
  "www.sswe.co.kr":     { title: "SSWE", description: "SSWE 학습 플랫폼 – 학생·선생님 로그인", favicon: "/tenants/sswe/favicon.png", image: "/tenants/sswe/logo-full.png", imageWidth: 800, imageHeight: 380 },
  "dnbacademy.co.kr":   { title: "DnB 보습학원", description: "DnB 보습학원 – 보습 전문 학습 플랫폼. 학생·선생님 로그인", favicon: "/tenants/dnb/favicon.png", image: "/tenants/dnb/og-image.png", imageWidth: 800, imageHeight: 420 },
  "www.dnbacademy.co.kr": { title: "DnB 보습학원", description: "DnB 보습학원 – 보습 전문 학습 플랫폼. 학생·선생님 로그인", favicon: "/tenants/dnb/favicon.png", image: "/tenants/dnb/og-image.png", imageWidth: 800, imageHeight: 420 },
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

function injectMeta(html: string, meta: TenantMeta, origin: string, host: string): string {
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

  // og:image — 절대 URL이면 그대로, 상대 경로면 origin 붙임
  if (image) {
    const normalized = normalizeImagePath(image);
    const absImage = normalized.startsWith("http") ? normalized : origin + normalized;
    // og:image + optional width/height (카카오톡 크롤러 힌트)
    let ogImageTag = `<meta property="og:image" content="${absImage}" />`;
    if (meta.imageWidth && meta.imageHeight) {
      ogImageTag += `\n    <meta property="og:image:width" content="${meta.imageWidth}" />`;
      ogImageTag += `\n    <meta property="og:image:height" content="${meta.imageHeight}" />`;
    }
    html = html.replace(
      /<meta property="og:image" content="[^"]*" \/>/,
      ogImageTag,
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

  // naver-site-verification — 테넌트별 네이버 Search Advisor 인증 코드
  const seo = TENANT_SEO[host];
  if (seo?.naver) {
    html = html.replace(
      "</head>",
      `    <meta name="naver-site-verification" content="${seo.naver}" />\n  </head>`,
    );
  }

  return html;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const pathname = url.pathname;
  const host = url.hostname.toLowerCase();
  const accept = context.request.headers.get("Accept") ?? "";

  // 네이버 Search Advisor HTML 파일 소유 확인 (/naver{hash}.html)
  const naverVerifyId = NAVER_HTML_VERIFY[host];
  if (naverVerifyId && pathname === `/${naverVerifyId}.html`) {
    return new Response(naverVerifyId, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=86400" },
    });
  }

  // 네이버/구글 등 검색엔진용: 테넌트별 동적 sitemap.xml
  if (pathname === "/sitemap.xml") {
    const xml = generateSitemap(host);
    if (xml) {
      return new Response(xml, {
        status: 200,
        headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=86400" },
      });
    }
    // 알 수 없는 호스트면 정적 sitemap.xml 폴백
  }

  // 테넌트별 동적 robots.txt
  if (pathname === "/robots.txt") {
    return new Response(generateRobots(host), {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" },
    });
  }

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

  // 테넌트별 메타 치환 — API 우선, 빈 필드는 폴백으로 보완
  const apiMeta = await fetchOgMeta(host);
  const fallback = FALLBACK_META[host];
  const meta = apiMeta
    ? {
        ...apiMeta,
        image: apiMeta.image || fallback?.image,
        favicon: apiMeta.favicon || fallback?.favicon,
        imageWidth: fallback?.imageWidth,
        imageHeight: fallback?.imageHeight,
      }
    : fallback;
  if (meta) {
    const origin = url.origin;
    html = injectMeta(html, meta, origin, host);
  }

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": res.headers.get("Cache-Control") ?? "no-cache",
    },
  });
};
