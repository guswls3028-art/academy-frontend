// PATH: src/app_admin/domains/notice/context/NoticeContext.tsx
import { createContext, useContext, useMemo, useState } from "react";
import type { Notice } from "../types";

type NoticeState = {
  notices: Notice[];
  unreadCount: number;
  remove: (id: string) => void;
  clear: () => void;
  push: (n: Notice) => void;
};

const NoticeContext = createContext<NoticeState | null>(null);

export function NoticeProvider({ children }: { children: React.ReactNode }) {
  const [notices, setNotices] = useState<Notice[]>([]);

  const unreadCount = useMemo(() => notices.length, [notices]);

  function remove(id: string) {
    setNotices((prev) => prev.filter((n) => n.id !== id));
  }

  function clear() {
    setNotices([]);
  }

  function push(n: Notice) {
    setNotices((prev) => [n, ...prev]);
  }

  return (
    <NoticeContext.Provider value={{ notices, unreadCount, remove, clear, push }}>
      {children}
    </NoticeContext.Provider>
  );
}

export function useNotices() {
  const ctx = useContext(NoticeContext);
  if (!ctx) {
    throw new Error("useNotices must be used within NoticeProvider");
  }
  return ctx;
}
