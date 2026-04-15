/**
 * 레이아웃에 삽입하는 투어 오버레이 — activeTour 감지 시 딜레이 후 투어 시작
 */
import { useState, useEffect } from "react";
import { useGuideTour } from "./GuideTourContext";
import { GuideTour } from "./GuideTour";

export function GuideTourOverlay() {
  const { activeTour, closeTour } = useGuideTour();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (activeTour) {
      // 타겟 페이지 렌더링 대기
      const t = setTimeout(() => setShow(true), 500);
      return () => clearTimeout(t);
    }
    setShow(false);
  }, [activeTour]);

  if (!show || !activeTour) return null;
  return <GuideTour steps={activeTour.steps} onClose={closeTour} />;
}
