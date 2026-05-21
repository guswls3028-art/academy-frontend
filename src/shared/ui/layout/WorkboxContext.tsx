/**
 * 선생앱: 헤더 우측 작업박스(진행 상황) 여닫이 상태.
 * Header의 작업박스 버튼과 AsyncStatusBar 패널 연동용.
 */
import { useCallback, useState, type ReactNode } from "react";
import { WorkboxContext } from "./WorkboxContextCore";

export function WorkboxProvider({ children }: { children: ReactNode }) {
  const [workboxOpen, setWorkboxOpen] = useState(false);
  const toggleWorkbox = useCallback(() => setWorkboxOpen((v) => !v), []);
  return (
    <WorkboxContext.Provider value={{ workboxOpen, setWorkboxOpen, toggleWorkbox }}>
      {children}
    </WorkboxContext.Provider>
  );
}
