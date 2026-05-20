// PATH: src/app_admin/domains/notice/context/NoticeContext.tsx
import { useCallback, useMemo, useState, type ReactNode } from "react";
import type { Notice } from "../types";
import { NoticeContext, type NoticeState } from "./noticeContextCore";

export function NoticeProvider({ children }: { children: ReactNode }) {
  const [notices, setNotices] = useState<Notice[]>([]);

  const unreadCount = useMemo(() => notices.length, [notices]);

  const remove = useCallback((id: string) => {
    setNotices((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clear = useCallback(() => {
    setNotices([]);
  }, []);

  const push = useCallback((n: Notice) => {
    setNotices((prev) => [n, ...prev]);
  }, []);

  const value = useMemo<NoticeState>(
    () => ({ notices, unreadCount, remove, clear, push }),
    [clear, notices, push, remove, unreadCount]
  );

  return (
    <NoticeContext.Provider value={value}>
      {children}
    </NoticeContext.Provider>
  );
}
