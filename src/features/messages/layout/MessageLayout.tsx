// PATH: src/features/messages/layout/MessageLayout.tsx
// 메시지 — students 도메인 디자인 기반 (StorageStyleTabs)

import { Outlet } from "react-router-dom";
import { DomainLayout } from "@/shared/ui/layout";
import { StorageStyleTabs } from "@/shared/ui/domain";
import styles from "@/shared/ui/domain/StorageStyleTabs.module.css";

const MESSAGE_TABS = [
  { key: "templates", label: "템플릿 저장", path: "/admin/message/templates" },
  { key: "send", label: "발송", path: "/admin/message/send" },
  { key: "auto-send", label: "자동발송", path: "/admin/message/auto-send" },
  { key: "log", label: "발송 내역", path: "/admin/message/log" },
  { key: "settings", label: "설정", path: "/admin/message/settings" },
];

export default function MessageLayout() {
  return (
    <DomainLayout
      title="메시지"
      description="템플릿 · 발송 · 자동발송 · 설정"
    >
      <div className={styles.wrap}>
        <StorageStyleTabs tabs={MESSAGE_TABS} />
        <Outlet />
      </div>
    </DomainLayout>
  );
}
