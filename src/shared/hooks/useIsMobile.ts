/**
 * 선생앱(관리자) 전용: 뷰포트가 모바일 폭이면 true.
 * TeacherViewContext의 forceView가 있으면 그에 따름(모바일/PC 버전 강제 보기).
 */
import { useEffect, useState } from "react";
import { useTeacherView } from "@/shared/ui/layout/TeacherViewContext";

/** 1024px 이하 = 모바일 레이아웃. 폰에서 '데스크톱 사이트' 켜도 ~980px라 모바일로 감. */
const QUERY = "(max-width: 1023px)";

export function useIsMobile(): boolean {
  const view = useTeacherView();
  const [realMobile, setRealMobile] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(QUERY).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const handler = () => setRealMobile(mql.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  if (view?.forceView === "mobile") return true;
  if (view?.forceView === "desktop") return false;
  return realMobile;
}
