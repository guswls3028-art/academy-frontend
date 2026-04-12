// PATH: src/app_admin/domains/notice/types.ts
export type NoticeLevel = "info" | "warning" | "success" | "error";

export type Notice = {
  id: string;
  title: string;
  body?: string;
  level: NoticeLevel;
  created_at: string;
};
