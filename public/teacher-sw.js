/**
 * teacher-sw.js — 선생님 모바일 앱 Service Worker
 *
 * 캐싱 전략:
 *   1. App Shell (HTML, CSS, JS, fonts) → Cache First
 *   2. API 데이터 (/api/v1/) → Network First (3초 타임아웃)
 *   3. 이미지 → Stale While Revalidate
 *
 * VersionChecker 호환:
 *   - /version.json 요청은 항상 네트워크 (캐시 안 함)
 *   - SW 업데이트 시 skipWaiting → clients.claim 으로 즉시 활성화
 */

const CACHE_VERSION = "v1";
const APP_SHELL_CACHE = `teacher-app-shell-${CACHE_VERSION}`;
const API_CACHE = `teacher-api-${CACHE_VERSION}`;
const IMAGE_CACHE = `teacher-images-${CACHE_VERSION}`;

const ALL_CACHES = [APP_SHELL_CACHE, API_CACHE, IMAGE_CACHE];

// App Shell: 최초 설치 시 프리캐싱할 URL은 없음 (Vite 해시 번들이라 런타임 캐싱)
// 대신 fetch 시점에 Cache First 전략 적용

// === Install ===
self.addEventListener("install", (event) => {
  // 새 SW가 설치되면 즉시 활성화 (대기 건너뜀)
  self.skipWaiting();
});

// === Activate ===
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("teacher-") && !ALL_CACHES.includes(k))
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// === Fetch ===
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. 네비게이션 요청 (HTML) — Network First, 오프라인 시 캐시된 /teacher 반환
  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  // 2. version.json — 항상 네트워크 (VersionChecker 호환)
  if (url.pathname === "/version.json") {
    return; // SW가 가로채지 않음 → 브라우저 기본 동작
  }

  // 3. API 요청 — Network First (3초 타임아웃)
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirstApi(request));
    return;
  }

  // 4. 이미지 — Stale While Revalidate
  if (isImageRequest(request)) {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE, 200));
    return;
  }

  // 5. 정적 에셋 (JS, CSS, fonts) — Cache First
  if (isStaticAsset(request)) {
    event.respondWith(cacheFirst(request, APP_SHELL_CACHE));
    return;
  }

  // 6. 기타 — 네트워크 통과
});

// === 전략 구현 ===

/** Network First (Navigation) — HTML은 항상 최신 시도, 실패 시 캐시 */
async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(APP_SHELL_CACHE);
      cache.put("/teacher", response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match("/teacher");
    if (cached) return cached;
    return new Response(
      '<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:60px 20px"><h2>오프라인</h2><p>인터넷 연결을 확인해주세요.</p></body></html>',
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
}

/** Network First (API) — 3초 타임아웃, 실패 시 캐시 */
async function networkFirstApi(request) {
  // GET만 캐싱 (POST/PATCH/DELETE 등은 통과)
  if (request.method !== "GET") {
    return fetch(request);
  }

  try {
    const response = await fetchWithTimeout(request, 3000);
    if (response.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: "offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/** Cache First — 정적 에셋 (Vite 해시 → 영구 캐시 가능) */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("", { status: 503 });
  }
}

/** Stale While Revalidate — 캐시 즉시 반환 + 백그라운드 갱신 */
async function staleWhileRevalidate(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        await cache.put(request, response.clone());
        // maxEntries 초과 시 오래된 항목 삭제
        if (maxEntries) await trimCache(cache, maxEntries);
      }
      return response;
    })
    .catch(() => cached);

  return cached || fetchPromise;
}

// === 유틸리티 ===

function fetchWithTimeout(request, ms) {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
      reject(new Error("timeout"));
    }, ms);

    fetch(request, { signal: controller.signal })
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function isStaticAsset(request) {
  const url = new URL(request.url);
  return /\.(js|css|woff2?|ttf|eot)(\?|$)/.test(url.pathname);
}

function isImageRequest(request) {
  const url = new URL(request.url);
  return /\.(png|jpe?g|gif|svg|webp|ico)(\?|$)/.test(url.pathname);
}

async function trimCache(cache, maxEntries) {
  const keys = await cache.keys();
  if (keys.length > maxEntries) {
    // FIFO: 가장 오래된 항목부터 삭제
    const excess = keys.length - maxEntries;
    for (let i = 0; i < excess; i++) {
      await cache.delete(keys[i]);
    }
  }
}

// === Push (Phase 2 준비 — 현재는 알림 표시만) ===
self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    event.waitUntil(
      self.registration.showNotification(payload.title || "학원플러스", {
        body: payload.body || "",
        icon: "/teacher-icons/icon-192.svg",
        badge: "/teacher-icons/icon-192.svg",
        tag: payload.tag || "teacher-notification",
        data: { url: payload.url || "/teacher" },
      })
    );
  } catch {
    // 잘못된 payload 무시
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/teacher";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // 이미 열린 탭이 있으면 포커스
        for (const client of clients) {
          if (new URL(client.url).pathname.startsWith("/teacher")) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        // 없으면 새 탭
        return self.clients.openWindow(targetUrl);
      })
  );
});
