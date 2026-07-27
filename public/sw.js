// PATH: public/sw.js
// 단순 service worker (#61 PWA) — 오프라인 셸 캐시 + stale-while-revalidate fetch.
// vite-plugin-pwa 외부 의존성 회피 — 정적 파일.
//
// 캐시 전략:
// - 정적 자산(JS/CSS/font/이미지): cache-first + 백그라운드 갱신 (stale-while-revalidate).
// - HTML: network-first → 실패 시 cache fallback (학원 도메인 셸).
// - API: 캐시 안 함 (네트워크만).
//
// 캐시 버전 변경 시 CACHE_NAME 숫자 증가 → 오래된 캐시 자동 정리.

const CACHE_NAME = "hakwonplus-shell-v2";
const APP_SHELL = [
  "/",
  "/landing",
  "/manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL).catch(() => {})),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("hakwonplus-shell-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 다른 origin (R2/CDN 등)은 그대로 통과
  if (url.origin !== self.location.origin) return;

  // API 요청은 캐시 안 함 (항상 fresh)
  if (url.pathname.startsWith("/api/")) return;

  // HTML 네비게이션 — network-first
  if (req.mode === "navigate" || req.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("/landing"))),
    );
    return;
  }

  // 정적 자산 — stale-while-revalidate
  if (/\.(js|mjs|css|png|jpe?g|webp|svg|gif|ico|woff2?|ttf)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetched = fetch(req).then((res) => {
          if (res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone)).catch(() => {});
          }
          return res;
        }).catch(() => cached);
        return cached || fetched;
      }),
    );
  }
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    event.waitUntil(
      self.registration.showNotification(payload.title || "학원플러스", {
        body: payload.body || "",
        icon: payload.icon || "/tenants/hakwonplus/pwa-192.png?v=20260727",
        badge: payload.badge || "/tenants/hakwonplus/apple-touch-icon.png?v=20260727",
        tag: payload.tag || "hakwonplus-notification",
        data: { url: payload.url || "/dev/inbox" },
      }),
    );
  } catch {
    // 잘못된 payload는 사용자 화면과 fetch 흐름에 영향을 주지 않는다.
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const requestedUrl = new URL(
    event.notification.data?.url || "/dev/inbox",
    self.location.origin,
  );
  const targetUrl = requestedUrl.origin === self.location.origin
    ? requestedUrl.toString()
    : new URL("/dev/inbox", self.location.origin).toString();

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const devClient = clients.find(
          (client) => {
            const url = new URL(client.url);
            return url.origin === self.location.origin
              && url.pathname.startsWith("/dev");
          },
        );
        if (devClient) {
          return devClient.navigate(targetUrl).then(() => devClient.focus());
        }
        return self.clients.openWindow(targetUrl);
      }),
  );
});
