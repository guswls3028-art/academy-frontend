// PATH: src/shared/ui/feedback/BugReportButton.tsx
// 문제 신고 모달 로더 — 프로필 드롭다운 이벤트는 가볍게 유지하고 실제 모달은 열 때만 로드.

import { lazy, Suspense, useEffect, useState } from "react";

const BugReportDialog = lazy(() => import("./BugReportDialog"));

/**
 * 문제 신고 모달 (플로팅 버튼 없음)
 * 외부에서 `ui:bugreport:open` 커스텀 이벤트로 열기
 */
export default function BugReportButton() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => {
      setMounted(true);
      setOpen(true);
    };
    document.addEventListener("ui:bugreport:open", handler);
    return () => document.removeEventListener("ui:bugreport:open", handler);
  }, []);

  if (!mounted) return null;

  return (
    <Suspense fallback={null}>
      <BugReportDialog open={open} onClose={() => setOpen(false)} />
    </Suspense>
  );
}
