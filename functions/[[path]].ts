// Cloudflare Pages Function: tchul.com 등 테넌트 도메인 접속 시
// HTML 문서의 <title> / og:title / og:description 을 브랜드명으로 치환.
// 카카오톡 등 크롤러는 JS를 실행하지 않으므로, 서버에서 내려줄 때부터 올바른 값이 필요함.

interface Env {
  ASSETS: Fetcher;
}

const STATIC_EXT = /\.(js|mjs|css|png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|eot|map|json|xml|txt|webmanifest)(\?.*)?$/i;

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const pathname = url.pathname;
  const host = url.hostname.toLowerCase();
  const accept = context.request.headers.get("Accept") ?? "";

  // 정적 파일은 그대로 ASSETS에 위임
  if (STATIC_EXT.test(pathname)) {
    return context.env.ASSETS.fetch(context.request);
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
