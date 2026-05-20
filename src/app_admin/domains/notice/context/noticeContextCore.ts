import { createContext } from "react";
import type { Notice } from "../types";

export type NoticeState = {
  notices: Notice[];
  unreadCount: number;
  remove: (id: string) => void;
  clear: () => void;
  push: (n: Notice) => void;
};

export const NoticeContext = createContext<NoticeState | null>(null);
