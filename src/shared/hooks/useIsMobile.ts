/** 선생앱(관리자) 전용: 현재 뷰포트가 모바일 폭이면 true. */
import { useEffect, useState } from "react";
import { listenMediaQuery } from "@/shared/utils/mediaQueryListener";

/** 1023px 이하 = 모바일 레이아웃. 폰에서 '데스크톱 사이트' 켜도 ~980px라 모바일로 감. */
const QUERY = "(max-width: 1023px)";

export function useIsMobile(): boolean {
  const [realMobile, setRealMobile] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(QUERY).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const handler = () => setRealMobile(mql.matches);
    return listenMediaQuery(mql, handler);
  }, []);

  return realMobile;
}
