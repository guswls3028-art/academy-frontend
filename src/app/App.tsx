// PATH: src/app/App.tsx
import { useEffect, useRef } from "react";
import { BrowserRouter, useLocation } from "react-router-dom";
import AppRouter from "./router/AppRouter";
import { AuthProvider } from "@/features/auth/context/AuthContext";
import QueryProvider from "./providers/QueryProvider";
import { ProgramProvider } from "@/shared/program";
import { ConfirmProvider } from "@/shared/ui/confirm";
import SubscriptionExpiredOverlay from "@/shared/ui/SubscriptionExpiredOverlay";
import ErrorBoundary from "@/shared/ui/ErrorBoundary";
import { feedback } from "@/shared/ui/feedback/feedback";

/* ──────────────────────────────────────────────
   Inline Version Checker (tree-shake 방지)
   ────────────────────────────────────────────── */
declare const __BUILD_TIMESTAMP__: string;

// blockAutoReload는 외부 파일에서 re-export
export { blockAutoReload, unblockAutoReload } from "@/shared/ui/layout/VersionChecker";

const _CUR_VER: string | undefined =
  typeof __BUILD_TIMESTAMP__ !== "undefined" ? __BUILD_TIMESTAMP__ : undefined;
let _pendingUpdate = false;

// 외부에서 block/unblock 시 이 값을 import 경로 통해 사용
let _blockCnt = 0;
function _isBlocked() { return _blockCnt > 0; }

async function _checkVer(): Promise<boolean> {
  if (!_CUR_VER) return false;
  try {
    const r = await fetch("/version.json?_=" + Date.now(), { cache: "no-store" });
    if (!r.ok) return false;
    const ct = r.headers.get("content-type") || "";
    if (!ct.includes("json")) return false;
    const d = await r.json();
    if (d.version && d.version !== _CUR_VER) { _pendingUpdate = true; return true; }
  } catch { /* ignore */ }
  return false;
}

function _reloadOrNotify() {
  if (_isBlocked()) {
    feedback.info("새 버전이 준비되었습니다. 작업 완료 후 자동 업데이트됩니다.");
    return;
  }
  window.location.reload();
}

function AppInner() {
  const location = useLocation();
  const initPath = useRef(location.pathname);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. 정기 폴링
  useEffect(() => {
    if (!_CUR_VER) return;
    const t1 = setTimeout(_checkVer, 60_000);
    const iv = setInterval(_checkVer, 5 * 60 * 1000);
    return () => { clearTimeout(t1); clearInterval(iv); };
  }, []);

  // 2. 라우트 전환 시
  useEffect(() => {
    if (location.pathname === initPath.current) return;
    if (_pendingUpdate) _reloadOrNotify();
  }, [location.pathname]);

  // 3. visibilitychange + pageshow
  useEffect(() => {
    if (!_CUR_VER) return;
    const onResume = () => {
      if (_pendingUpdate) { _reloadOrNotify(); return; }
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        if (await _checkVer()) _reloadOrNotify();
      }, 2000);
    };
    const onVis = () => { if (document.visibilityState === "visible") onResume(); };
    const onPage = (e: PageTransitionEvent) => { if (e.persisted) onResume(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pageshow", onPage);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pageshow", onPage);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return (
    <>
      <AppRouter />
      <SubscriptionExpiredOverlay />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryProvider>
        <BrowserRouter>
          <ConfirmProvider>
            <ProgramProvider>
              <AuthProvider>
                <AppInner />
              </AuthProvider>
            </ProgramProvider>
          </ConfirmProvider>
        </BrowserRouter>
      </QueryProvider>
    </ErrorBoundary>
  );
}
