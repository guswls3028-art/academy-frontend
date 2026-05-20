import { useContext } from "react";
import { NoticeContext } from "./noticeContextCore";

export function useNotices() {
  const ctx = useContext(NoticeContext);
  if (!ctx) {
    throw new Error("useNotices must be used within NoticeProvider");
  }
  return ctx;
}
