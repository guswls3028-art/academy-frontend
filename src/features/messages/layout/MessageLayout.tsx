// PATH: src/features/messages/layout/MessageLayout.tsx
// 메시지 — 등록 · 로그 · 가이드

import { Outlet } from "react-router-dom";
import { DomainLayout } from "@/shared/ui/layout";

const MESSAGE_TABS = [
  { key: "templates", label: "템플릿 저장", path: "/admin/message/templates" },
  { key: "register", label: "메시지 등록", path: "/admin/message/register" },
  { key: "link", label: "카카오 연동", path: "/admin/message/link" },
  { key: "log", label: "발송 내역", path: "/admin/message/log" },
  { key: "guide", label: "가이드 확인", path: "/admin/message/guide" },
];

export default function MessageLayout() {
  return (
    <DomainLayout
      title="메시지"
      description="메시지 등록 · 발송 로그 · 가이드"
      tabs={MESSAGE_TABS}
    >
      <Outlet />
    </DomainLayout>
  );
}
