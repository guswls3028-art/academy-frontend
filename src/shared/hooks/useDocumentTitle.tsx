// PATH: src/shared/hooks/useDocumentTitle.tsx
// 브라우저 타이틀 동적 설정 Hook

import { useEffect } from "react";
import { useProgram } from "@/shared/program";

export function useDocumentTitle(title?: string) {
  const { program } = useProgram();

  useEffect(() => {
    // 명시적 title이 있으면 우선 사용
    if (title) {
      document.title = title;
      return;
    }

    // Program의 ui_config.window_title 또는 display_name 사용
    const windowTitle = program?.ui_config?.window_title;
    const displayName = program?.display_name;
    
    if (windowTitle) {
      document.title = windowTitle;
    } else if (displayName) {
      document.title = displayName;
    } else {
      document.title = "HakwonPlus";
    }
  }, [title, program]);
}
