// PATH: src/shared/ui/page/OverlayPage.tsx
// --------------------------------------------------
// OverlayPage
//
// - 관리자 페이지용 공용 Overlay 컨테이너
// - 중앙 카드 형태의 "페이지"를 Overlay로 표현
//
// 기능:
// - Dim background
// - ESC 키로 닫기
// - 모바일(md 이하)에서는 full-screen 전환
//
// 규칙:
// - 내부에서는 반드시 Page 계열 컴포넌트 사용
// --------------------------------------------------

import { ReactNode, useEffect } from "react";

type Props = {
  children: ReactNode;
  onClose: () => void;
};

export default function OverlayPage({ children, onClose }: Props) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      <div
        className="
          relative z-10
          w-full max-w-[1200px]
          h-full md:h-auto
          md:rounded-xl
          bg-[var(--bg-app)]
          shadow-xl
          overflow-auto
        "
      >
        {children}
      </div>
    </div>
  );
}
