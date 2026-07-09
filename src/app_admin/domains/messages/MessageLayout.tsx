// PATH: src/app_admin/domains/messages/MessageLayout.tsx
// 메시지 — DomainLayout 탭 SSOT

import { Outlet, Link } from "react-router-dom";
import { DomainLayout } from "@/shared/ui/layout";
import type { DomainTab } from "@/shared/ui/domain";
import { useMessagingInfo } from "@admin/domains/messages/hooks/useMessagingInfo";
import styles from "./MessageLayout.module.css";

const MESSAGE_TABS: DomainTab[] = [
  { key: "templates", label: "문구 저장", path: "/admin/message/templates" },
  { key: "auto-send", label: "자동발송", path: "/admin/message/auto-send" },
  { key: "log", label: "발송 내역", path: "/admin/message/log" },
  { key: "settings", label: "설정", path: "/admin/message/settings" },
];

export default function MessageLayout() {
  const { data: info } = useMessagingInfo();
  const alimtalkAvailable = info?.alimtalk_available ?? Boolean(info?.kakao_pfid);

  return (
    <DomainLayout
      title="메시지"
      description="알림톡 문구 · 자동발송 · 발송 내역 · 설정"
      tabs={MESSAGE_TABS}
    >
      {!alimtalkAvailable && info && (
        <div className={styles.alimtalkNotice}>
          <span>알림톡 발송 준비 상태를 확인해 주세요</span>
          <Link
            to="/admin/message/settings"
            className={styles.alimtalkNoticeLink}
          >
            설정 보기 →
          </Link>
        </div>
      )}
      <Outlet />
    </DomainLayout>
  );
}
