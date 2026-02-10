// PATH: src/features/notice/context/NoticeContext.tsx
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
  const [notices, setNotices] = useState<Notice[]>([
    {
      id: "n-001",
      title: "시험 채점이 완료되었습니다",
      body: "고2 모의고사 · 결과 업데이트됨",
      level: "success",
      created_at: new Date().toISOString(),
    },
    {
      id: "n-002",
      title: "오늘 클리닉 일정이 있습니다",
      body: "오후 6시 · 중3 수학",
      level: "info",
      created_at: new Date().toISOString(),
    },
  ]);

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
