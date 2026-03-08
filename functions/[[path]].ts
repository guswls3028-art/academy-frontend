// Cloudflare Pages Function: tchul.com 등 테넌트 도메인 접속 시
// HTML 문서의 <title> / og:title / og:description 을 브랜드명으로 치환.
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

  // HTML 문서 요청이 아니면 그대로 위임
  if (!accept.includes("text/html")) {
    return context.env.ASSETS.fetch(context.request);
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

  // tchul.com / www.tchul.com → 박철과학
  if (host === "tchul.com" || host === "www.tchul.com") {
    const title = "박철과학";
    const desc = "박철과학 학습 플랫폼 – 학생·선생님 로그인";
    html = html.replace(/<title>HakwonPlus<\/title>/, `<title>${title}</title>`);
    html = html.replace(
      /<meta property="og:title" content="HakwonPlus" \/>/,
      `<meta property="og:title" content="${title}" />`
    );
    html = html.replace(
      /<meta property="og:description" content="[^"]*" \/>/,
      `<meta property="og:description" content="${desc}" />`
    );
    html = html.replace(
      /<meta name="twitter:title" content="HakwonPlus" \/>/,
      `<meta name="twitter:title" content="${title}" />`
    );
    html = html.replace(
      /<meta name="twitter:description" content="[^"]*" \/>/,
      `<meta name="twitter:description" content="${desc}" />`
    );
  }

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": res.headers.get("Cache-Control") ?? "no-cache",
    },
  });
};
