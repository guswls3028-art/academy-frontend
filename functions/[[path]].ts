// Cloudflare Pages Function: 테넌트 도메인 접속 시
// HTML 문서의 <title> / og:title / og:description / og:image / og:url 등을 브랜드명으로 치환.
// 카카오톡 등 크롤러는 JS를 실행하지 않으므로, 서버에서 내려줄 때부터 올바른 값이 필요함.
//
// 배포: index.html과 /assets/* 청크는 반드시 동일 빌드에서 함께 업로드되어야 함.
// 청크 해시가 바뀌면 이전 빌드의 index.html이 이전 청크를 요청해 404 → HTML 반환 시 MIME 오류 발생.

import { WORKSPACE_PATHS } from "../src/core/router/workspaceRoutes";

interface Env {
  ASSETS: Fetcher;
}

const STATIC_EXT = /\.(js|mjs|css|png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|eot|map|json|xml|txt|webmanifest)(\?.*)?$/i;
const STATIC_HTML_PATHS = new Set(["/omr-sheet", "/omr-sheet.html"]);

function createCspNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

function contentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src 'self' 'nonce-${nonce}' https://js.tosspayments.com https://www.youtube.com`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https: wss:",
    "media-src 'self' data: blob: https:",
    "frame-src https://www.youtube.com https://www.youtube-nocookie.com https://api.hakwonplus.com",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

async function withSecurityHeaders(response: Response): Promise<Response> {
  const nonce = createCspNonce();
  const headers = new Headers(response.headers);
  headers.set("Content-Security-Policy", contentSecurityPolicy(nonce));
  headers.set("X-Frame-Options", "DENY");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");

  const contentType = headers.get("Content-Type") ?? "";
  if (response.body && contentType.includes("text/html")) {
    const html = await response.text();
    const nonceHtml = html.replace(/<script(?=[\s>])/gi, `<script nonce="${nonce}"`);
    headers.delete("Content-Length");
    return new Response(nonceHtml, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function isExpectedStaticHtml(pathname: string, html: string): boolean {
  if (STATIC_HTML_PATHS.has(pathname)) {
    return html.includes("OMR 답안지 생성기로 이동")
      && html.includes('data-omr-canonical-route="/workspace/tools/omr"');
  }
  return false;
}

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
  pwaIcon192?: string;
  pwaIcon512?: string;
  appleTouchIcon?: string;
}

const HAKWONPLUS_HOSTS = new Set(["hakwonplus.com", "www.hakwonplus.com"]);
const DEV_CONSOLE_HOST = "dev.hakwonplus.com";
const DEV_CONSOLE_ORIGIN = `https://${DEV_CONSOLE_HOST}`;

const HAKWONPLUS_PROMO_META: Record<string, TenantMeta> = {
  "/promo": {
    title: "학원플러스 | 학원의 수업과 운영을 한 흐름으로",
    description: "강의·학생·출결·성적·보강 관리와 학생앱 영상, 알림톡, 칠판용 PPT·매치업, 학원 홈페이지를 한곳에서 이어갑니다.",
  },
  "/promo/features": {
    title: "기능과 실제 화면 | 학원플러스",
    description: "강의·학생·출결·성적·보강 관리와 학생앱 영상, 알림톡, 칠판용 PPT·매치업, 학원 홈페이지를 목적별로 확인하세요.",
  },
  "/promo/matchup-ppt": {
    title: "적중 매치업과 칠판용 PPT | 학원플러스",
    description: "매치업의 문항 자동 분리·유사 후보·선생님 확정 과정과 PDF·이미지를 흑백반전 칠판용 PPT로 만드는 과정을 각각 보여드립니다.",
  },
  "/promo/parent-trust": {
    title: "학부모 상담을 위한 수업 기록 | 학원플러스",
    description: "출결·성적·영상·보강 기록을 확인하고, 선생님이 학부모 안내와 상담에 활용하는 흐름을 확인하세요.",
  },
  "/promo/ai-grading": {
    title: "자동채점과 성적 관리 | 학원플러스",
    description: "객관식·OX형과 일부 수학 단답형(0~999 정수)은 자동으로 채점하고, 서술형은 선생님이 직접 확인하는 성적 관리 흐름을 소개합니다.",
  },
  "/promo/video-platform": {
    title: "학생앱 영상 복습과 시청 이력 | 학원플러스",
    description: "학생은 앱에서 영상을 이어 보고, 선생님은 시청 상태를 확인해 필요한 복습 안내를 보낼 수 있습니다.",
  },
  "/promo/pricing": {
    title: "요금 안내 | 8월 14만 5천원·이후 18만원 | 학원플러스",
    description: "2026년 8월 가입은 월 14만 5천원, 9월 이후 가입은 월 18만원입니다. 두 금액 모두 부가세 10% 별도이며 8월 가입 공급가는 이용 기간 동안 유지됩니다.",
  },
  "/promo/updates": {
    title: "업데이트 소식 | 학원플러스",
    description: "선생님과 학생이 실제 화면에서 체감하는 학원플러스의 새 기능과 운영 개선 내용을 날짜순으로 확인하세요.",
  },
  "/promo/faq": {
    title: "자주 묻는 질문 | 학원플러스",
    description: "요금, 자료 이전, 채점, 영상, 알림톡 등 학원플러스를 사용하기 전에 자주 묻는 질문을 확인하세요.",
  },
  "/promo/contact": {
    title: "사용 상담 | 학원플러스",
    description: "현재 수업 방식과 필요한 기능을 알려주시면 사용할 내용과 시작 일정을 함께 정리해드립니다.",
  },
  "/promo/demo": {
    title: "내 자료로 데모 요청 | 학원플러스",
    description: "현재 수업과 관리 방식을 기준으로 영상, 알림톡, 학생 관리, 칠판용 PPT·매치업과 학원 홈페이지 화면을 확인해보세요.",
  },
};

const HAKWONPLUS_PROMO_ROUTES = new Set([
  ...Object.keys(HAKWONPLUS_PROMO_META),
  "/promo/landing-samples",
]);

const HAKWONPLUS_INDEXABLE_PROMO_ROUTES = [
  "/promo",
  "/promo/features",
  "/promo/matchup-ppt",
  "/promo/parent-trust",
  "/promo/ai-grading",
  "/promo/video-platform",
  "/promo/pricing",
  "/promo/updates",
  "/promo/faq",
];

interface TenantPwaMeta {
  title: string;
  icon: string;
  icon512?: string;
  themeColor?: string;
  backgroundColor?: string;
}

interface WebManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose: string;
}

interface AppWebManifest {
  name: string;
  short_name: string;
  description: string;
  id: string;
  start_url: string;
  scope: string;
  display: string;
  orientation: string;
  theme_color: string;
  background_color: string;
  icons: WebManifestIcon[];
  categories: string[];
  lang: string;
  dir: string;
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
  "movementhui.com":    { domain: "movementhui.com",    loginPath: "/login/movementhui" },
  "www.movementhui.com": { domain: "movementhui.com",   loginPath: "/login/movementhui" },
  "godmin.kr":          { domain: "godmin.kr",          loginPath: "/login/godmin" },
  "www.godmin.kr":      { domain: "godmin.kr",          loginPath: "/login/godmin" },
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
  const base = `https://${seo.domain}`;
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const primaryRoutes = HAKWONPLUS_HOSTS.has(host)
    ? HAKWONPLUS_INDEXABLE_PROMO_ROUTES
    : [seo.loginPath];
  const primaryEntries = primaryRoutes.map((pathname, index) => `  <url>
    <loc>${base}${pathname}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${pathname === "/promo" ? "weekly" : "monthly"}</changefreq>
    <priority>${index === 0 ? "1.0" : "0.8"}</priority>
  </url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${primaryEntries}
  <url>
    <loc>${base}/terms</loc>
    <lastmod>${today}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>${base}/privacy</loc>
    <lastmod>${today}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>
</urlset>`;
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
    "Disallow: /workspace",
    "Disallow: /workspace/",
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
  "hakwonplus.com":     { title: "학원플러스 | 학원의 수업과 운영을 한 흐름으로",  description: "강의·학생·출결·성적·보강 관리와 학생앱 영상, 알림톡, 칠판용 PPT·매치업, 학원 홈페이지를 한곳에서 이어갑니다.", favicon: "/tenants/hakwonplus/favicon.png?v=20260727", image: "/tenants/hakwonplus/og-image.png", imageWidth: 1200, imageHeight: 630 },
  "www.hakwonplus.com": { title: "학원플러스 | 학원의 수업과 운영을 한 흐름으로",  description: "강의·학생·출결·성적·보강 관리와 학생앱 영상, 알림톡, 칠판용 PPT·매치업, 학원 홈페이지를 한곳에서 이어갑니다.", favicon: "/tenants/hakwonplus/favicon.png?v=20260727", image: "/tenants/hakwonplus/og-image.png", imageWidth: 1200, imageHeight: 630 },
  "dev.hakwonplus.com": { title: "학원플러스 콘솔", description: "학원플러스 문의와 운영 상태를 확인하는 개발자 콘솔", favicon: "/tenants/hakwonplus/favicon.png?v=20260727", image: "/tenants/hakwonplus/og-image.png", imageWidth: 1200, imageHeight: 630, appleTouchIcon: "/tenants/hakwonplus/apple-touch-icon.png?v=20260727" },
  "sswe.co.kr":         { title: "SSWE", description: "SSWE 학습 플랫폼 – 학생·선생님 로그인", favicon: "/tenants/sswe/favicon.png", image: "/tenants/sswe/logo-full.png", imageWidth: 800, imageHeight: 380 },
  "www.sswe.co.kr":     { title: "SSWE", description: "SSWE 학습 플랫폼 – 학생·선생님 로그인", favicon: "/tenants/sswe/favicon.png", image: "/tenants/sswe/logo-full.png", imageWidth: 800, imageHeight: 380 },
  "dnbacademy.co.kr":   { title: "DnB 보습학원", description: "DnB 보습학원 – 보습 전문 학습 플랫폼. 학생·선생님 로그인", favicon: "/tenants/dnb/favicon.png", image: "/tenants/dnb/og-image.png", imageWidth: 800, imageHeight: 420 },
  "www.dnbacademy.co.kr": { title: "DnB 보습학원", description: "DnB 보습학원 – 보습 전문 학습 플랫폼. 학생·선생님 로그인", favicon: "/tenants/dnb/favicon.png", image: "/tenants/dnb/og-image.png", imageWidth: 800, imageHeight: 420 },
  "movementhui.com":    { title: "이동휘원소 과학연구소", description: "이동휘원소 과학연구소 학습 플랫폼 – 학생·학부모·선생님 로그인", favicon: "/tenants/movementhui/favicon.png", image: "/tenants/movementhui/og-image.png", imageWidth: 500, imageHeight: 500 },
  "www.movementhui.com": { title: "이동휘원소 과학연구소", description: "이동휘원소 과학연구소 학습 플랫폼 – 학생·학부모·선생님 로그인", favicon: "/tenants/movementhui/favicon.png", image: "/tenants/movementhui/og-image.png", imageWidth: 500, imageHeight: 500 },
  "godmin.kr":          { title: "신민T 통합과학 | 신과함께", description: "13년 차 통합과학 강사 신민T의 수업 철학과 학습 관리, 수강생·학부모 전용 학습 플랫폼.", favicon: "/tenants/godmin/favicon.png", image: "/tenants/godmin/og-image.png", imageWidth: 1200, imageHeight: 630 },
  "www.godmin.kr":      { title: "신민T 통합과학 | 신과함께", description: "13년 차 통합과학 강사 신민T의 수업 철학과 학습 관리, 수강생·학부모 전용 학습 플랫폼.", favicon: "/tenants/godmin/favicon.png", image: "/tenants/godmin/og-image.png", imageWidth: 1200, imageHeight: 630 },
};

const FALLBACK_TEACHER_PWA: Record<string, TenantPwaMeta> = {
  "tchul.com":          { title: "박철 과학", icon: "/tenants/tchul/pwa-192.png", icon512: "/tenants/tchul/pwa-512.png" },
  "www.tchul.com":      { title: "박철 과학", icon: "/tenants/tchul/pwa-192.png", icon512: "/tenants/tchul/pwa-512.png" },
  "ymath.co.kr":        { title: "Y_math", icon: "/tenants/ymath/pwa-192.png", icon512: "/tenants/ymath/pwa-512.png" },
  "www.ymath.co.kr":    { title: "Y_math", icon: "/tenants/ymath/pwa-192.png", icon512: "/tenants/ymath/pwa-512.png" },
  "limglish.kr":        { title: "임근혁 영어", icon: "/tenants/limglish/pwa-192.png", icon512: "/tenants/limglish/pwa-512.png" },
  "www.limglish.kr":    { title: "임근혁 영어", icon: "/tenants/limglish/pwa-192.png", icon512: "/tenants/limglish/pwa-512.png" },
  "hakwonplus.com":     { title: "학원플러스", icon: "/tenants/hakwonplus/pwa-192.png?v=20260727", icon512: "/tenants/hakwonplus/pwa-512.png?v=20260727", themeColor: "#37D6F2", backgroundColor: "#0A0E1A" },
  "www.hakwonplus.com": { title: "학원플러스", icon: "/tenants/hakwonplus/pwa-192.png?v=20260727", icon512: "/tenants/hakwonplus/pwa-512.png?v=20260727", themeColor: "#37D6F2", backgroundColor: "#0A0E1A" },
  "sswe.co.kr":         { title: "SSWE", icon: "/tenants/sswe/pwa-192.png", icon512: "/tenants/sswe/pwa-512.png" },
  "www.sswe.co.kr":     { title: "SSWE", icon: "/tenants/sswe/pwa-192.png", icon512: "/tenants/sswe/pwa-512.png" },
  "dnbacademy.co.kr":   { title: "DnB 보습학원", icon: "/tenants/dnb/pwa-192.png", icon512: "/tenants/dnb/pwa-512.png" },
  "www.dnbacademy.co.kr": { title: "DnB 보습학원", icon: "/tenants/dnb/pwa-192.png", icon512: "/tenants/dnb/pwa-512.png" },
  "movementhui.com":    { title: "이동휘원소", icon: "/tenants/movementhui/pwa-192.png", icon512: "/tenants/movementhui/pwa-512.png", themeColor: "#1a253b", backgroundColor: "#1a253b" },
  "www.movementhui.com": { title: "이동휘원소", icon: "/tenants/movementhui/pwa-192.png", icon512: "/tenants/movementhui/pwa-512.png", themeColor: "#1a253b", backgroundColor: "#1a253b" },
  "godmin.kr":          { title: "신과함께", icon: "/tenants/godmin/pwa-192.png", icon512: "/tenants/godmin/pwa-512.png", themeColor: "#147a62", backgroundColor: "#e4f7ef" },
  "www.godmin.kr":      { title: "신과함께", icon: "/tenants/godmin/pwa-192.png", icon512: "/tenants/godmin/pwa-512.png", themeColor: "#147a62", backgroundColor: "#e4f7ef" },
};

function iconContentType(icon: string): string {
  if (/\.svg(\?.*)?$/i.test(icon)) return "image/svg+xml";
  if (/\.webp(\?.*)?$/i.test(icon)) return "image/webp";
  return "image/png";
}

async function pwaMetaForHost(host: string): Promise<TenantPwaMeta> {
  const fallback = FALLBACK_META[host];
  const known = FALLBACK_TEACHER_PWA[host];
  if (known) return known;

  const apiMeta = await fetchOgMeta(host);
  const neutralIcon = "/teacher-icons/icon-192.svg";
  return {
    title: apiMeta?.title ?? fallback?.title ?? host.split(".")[0] ?? "학원",
    icon:
      apiMeta?.pwaIcon192
      ?? apiMeta?.favicon
      ?? fallback?.favicon
      ?? neutralIcon,
    icon512: apiMeta?.pwaIcon512 ?? apiMeta?.pwaIcon192 ?? neutralIcon,
  };
}

async function buildAppManifest(
  host: string,
  audience: "teacher" | "student",
): Promise<AppWebManifest> {
  const meta = await pwaMetaForHost(host);
  const icon = normalizeImagePath(meta.icon);
  const icon512 = normalizeImagePath(meta.icon512 ?? meta.icon);
  const iconType = iconContentType(icon);
  const icon512Type = iconContentType(icon512);
  const isTeacher = audience === "teacher";
  const audienceLabel = isTeacher ? "모바일 업무" : "학생";
  const startUrl = isTeacher ? WORKSPACE_PATHS.mobile : "/student";

  return {
    name: `${meta.title} ${audienceLabel}`,
    short_name: meta.title,
    description: isTeacher
      ? `${meta.title} 교직원용 모바일 업무 앱 - 출석, 성적, 학생 관리`
      : `${meta.title} 학생 전용 모바일 앱 - 수업, 과제, 성적 확인`,
    // 기존 설치 앱과 동일한 identity를 유지하면서 시작 경로만 canonical URL로 옮긴다.
    id: isTeacher ? WORKSPACE_PATHS.legacyMobile : startUrl,
    start_url: startUrl,
    scope: startUrl,
    display: "standalone",
    orientation: "portrait",
    theme_color: meta.themeColor ?? "#3b82f6",
    background_color: meta.backgroundColor ?? "#f8fafc",
    icons: [
      {
        src: icon,
        sizes: icon.includes("/pwa-192.") ? "192x192" : "any",
        type: iconType,
        purpose: "any",
      },
      {
        src: icon512,
        sizes: icon512.includes("/pwa-512.") ? "512x512" : "any",
        type: icon512Type,
        purpose: "any maskable",
      },
    ],
    categories: ["education", "productivity"],
    lang: "ko",
    dir: "ltr",
  };
}

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
    const json = await res.json() as {
      title?: string;
      description?: string;
      image?: string;
      favicon?: string;
      pwa_icon_192?: string;
      pwa_icon_512?: string;
      apple_touch_icon?: string;
    };
    if (!json.title) return null;
    const meta: TenantMeta = {
      title: json.title,
      description: json.description || `${json.title} 학습 플랫폼`,
      image: json.image || undefined,
      favicon: json.favicon || undefined,
      pwaIcon192: json.pwa_icon_192 || undefined,
      pwaIcon512: json.pwa_icon_512 || undefined,
      appleTouchIcon: json.apple_touch_icon || undefined,
    };
    ogCache[host] = { data: meta, ts: Date.now() };
    return meta;
  } catch {
    return null;
  }
}

function injectMeta(
  html: string,
  meta: TenantMeta,
  origin: string,
  pageUrl: string,
  host: string,
  pathname: string,
): string {
  const { title, description, favicon, image } = meta;
  const siteName = HAKWONPLUS_HOSTS.has(host) || host === DEV_CONSOLE_HOST
    ? "학원플러스"
    : title;

  // <title>
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
  html = html.replace(
    /<meta name="description" content="[^"]*" \/>/,
    `<meta name="description" content="${description}" />`,
  );
  html = html.replace(
    /<link rel="canonical" href="[^"]*" \/>/,
    `<link rel="canonical" href="${pageUrl}" />`,
  );

  // og:site_name, og:title, og:description
  html = html.replace(
    /<meta property="og:site_name" content="[^"]*" \/>/,
    `<meta property="og:site_name" content="${siteName}" />`,
  );
  html = html.replace(
    /<meta property="og:title" content="[^"]*" \/>/,
    `<meta property="og:title" content="${title}" />`,
  );
  html = html.replace(
    /<meta property="og:description" content="[^"]*" \/>/,
    `<meta property="og:description" content="${description}" />`,
  );

  // og:url — 쿼리를 제외한 현재 페이지 canonical URL
  html = html.replace(
    /<meta property="og:url" content="[^"]*" \/>/,
    `<meta property="og:url" content="${pageUrl}" />`,
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

  if (host === DEV_CONSOLE_HOST) {
    html = html.replace(
      /<link rel="manifest" href="[^"]*" \/>/,
      '<link rel="manifest" href="/dev-manifest.json" />',
    );
    html = html.replace(
      /<meta name="theme-color" content="[^"]*" \/>/,
      '<meta name="theme-color" content="#0f172a" />',
    );
    html = html.replace(
      /<meta name="apple-mobile-web-app-title" content="[^"]*" \/>/,
      '<meta name="apple-mobile-web-app-title" content="학원플러스 콘솔" />',
    );
    html = html.replace(
      "</head>",
      `    <link rel="apple-touch-icon" href="${meta.appleTouchIcon}" />\n`
        + '    <meta name="robots" content="noindex, nofollow, noarchive" />\n'
        + "  </head>",
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

  if (HAKWONPLUS_HOSTS.has(host) && HAKWONPLUS_PROMO_ROUTES.has(pathname)) {
    const structuredData = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "학원플러스",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: pageUrl,
      description,
      offers: {
        "@type": "Offer",
        price: "145000",
        priceCurrency: "KRW",
        priceValidUntil: "2026-08-31",
        description: "2026년 8월 가입은 월 14만 5천원, 9월 이후 가입은 월 18만원입니다. 두 금액 모두 부가세 10% 별도이며 8월 가입 공급가는 이용 기간 동안 유지됩니다. 안내된 기능 및 200GB 저장공간 포함",
      },
    });
    html = html.replace(
      "</head>",
      `    <script id="promo-structured-data" type="application/ld+json">${structuredData}</script>\n  </head>`,
    );
  }

  return html;
}

const handleRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const pathname = url.pathname;
  const host = url.hostname.toLowerCase();

  if (
    HAKWONPLUS_HOSTS.has(host)
    && (pathname === "/dev" || pathname.startsWith("/dev/"))
  ) {
    const target = new URL(`${pathname}${url.search}`, DEV_CONSOLE_ORIGIN);
    return Response.redirect(target.toString(), 308);
  }

  if (host === DEV_CONSOLE_HOST && pathname === "/") {
    return Response.redirect(`${DEV_CONSOLE_ORIGIN}/dev/inbox`, 308);
  }

  if (
    HAKWONPLUS_HOSTS.has(host)
    && !STATIC_EXT.test(pathname)
    && (pathname === "/promo/" || pathname.startsWith("/promo/"))
  ) {
    const canonicalPath = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
    if (canonicalPath !== pathname && HAKWONPLUS_PROMO_ROUTES.has(canonicalPath)) {
      const target = new URL(url);
      target.pathname = canonicalPath;
      return Response.redirect(target.toString(), 308);
    }
    if (!HAKWONPLUS_PROMO_ROUTES.has(pathname)) {
      return new Response("Not Found", {
        status: 404,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }
  }

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
        headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
      });
    }
    // 알 수 없는 호스트면 정적 sitemap.xml 폴백
  }

  // 테넌트별 동적 robots.txt
  if (pathname === "/robots.txt") {
    if (host === DEV_CONSOLE_HOST) {
      return new Response("User-agent: *\nDisallow: /\n", {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "public, max-age=86400",
        },
      });
    }
    return new Response(generateRobots(host), {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" },
    });
  }

  if (pathname === "/teacher-manifest.json" || pathname === "/student-manifest.json") {
    const audience = pathname.startsWith("/teacher") ? "teacher" : "student";
    return new Response(JSON.stringify(await buildAppManifest(host, audience), null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/manifest+json; charset=utf-8",
        "Cache-Control": "no-cache",
        "Vary": "Host",
      },
    });
  }

  if (STATIC_HTML_PATHS.has(pathname)) {
    const res = await context.env.ASSETS.fetch(context.request);
    const ct = res.headers.get("Content-Type") ?? "";
    if (res.status === 200 && ct.includes("text/html")) {
      const html = await res.clone().text();
      if (isExpectedStaticHtml(pathname, html)) {
        return res;
      }
    }
    return new Response("Not Found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  // 정적 파일은 그대로 ASSETS에 위임
  if (STATIC_EXT.test(pathname)) {
    const res = await context.env.ASSETS.fetch(context.request);
    const ct = res.headers.get("Content-Type") ?? "";
    // 404이거나 200인데 HTML(SPA 폴백)이 오면 → MIME 오류 방지로
    // 404 + 올바른 Content-Type 반환. 전파 중의 일시적 asset miss가
    // edge에 오래 남지 않도록 negative response는 절대 캐시하지 않는다.
    if (res.status >= 400 || ct.includes("text/html")) {
      return new Response("/* 404 Not Found */", {
        status: 404,
        headers: {
          "Content-Type": contentTypeForPath(pathname),
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
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
  const apiMeta = host === DEV_CONSOLE_HOST ? null : await fetchOgMeta(host);
  const fallback = FALLBACK_META[host];
  const tenantMeta = apiMeta
    ? {
        ...apiMeta,
        image: apiMeta.image || fallback?.image,
        favicon: apiMeta.favicon || fallback?.favicon,
        imageWidth: fallback?.imageWidth,
        imageHeight: fallback?.imageHeight,
      }
    : fallback;
  const promoMeta = HAKWONPLUS_HOSTS.has(host) ? HAKWONPLUS_PROMO_META[pathname] : undefined;
  const meta = promoMeta
    ? {
        ...fallback,
        ...promoMeta,
      }
    : tenantMeta;
  if (meta) {
    const origin = url.origin;
    const pageUrl = `${origin}${pathname}`;
    html = injectMeta(html, meta, origin, pageUrl, host, pathname);
  }

  const headers = new Headers({
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": res.headers.get("Cache-Control") ?? "no-cache",
    "Strict-Transport-Security": "max-age=31536000",
  });
  if (host === DEV_CONSOLE_HOST) {
    headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }

  return new Response(html, {
    status: 200,
    headers,
  });
};

export const onRequestGet: PagesFunction<Env> = async (context) => (
  withSecurityHeaders(await handleRequestGet(context))
);
