// PATH: src/features/messages/layout/MessageLayout.tsx
// 메시지 — DomainLayout 탭 SSOT

import { Outlet, Link } from "react-router-dom";
import { DomainLayout } from "@/shared/ui/layout";
import type { DomainTab } from "@/shared/ui/domain";
import { useMessagingInfo } from "@/features/messages/hooks/useMessagingInfo";

const MESSAGE_TABS: DomainTab[] = [
  { key: "templates", label: "템플릿 저장", path: "/admin/message/templates" },
  { key: "auto-send", label: "자동발송", path: "/admin/message/auto-send" },
  { key: "log", label: "발송 내역", path: "/admin/message/log" },
  { key: "settings", label: "설정", path: "/admin/message/settings" },
];

export default function MessageLayout() {
  const { data: info } = useMessagingInfo();
  const smsConnected = info?.sms_allowed ?? false;

  return (
    <DomainLayout
      title="메시지"
      description="템플릿 · 자동발송 · 발송 내역 · 설정"
      tabs={MESSAGE_TABS}
    >
      {!smsConnected && info && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            padding: "5px 14px",
            borderRadius: 0,
            background: "color-mix(in srgb, var(--color-status-warning, #d97706) 7%, var(--color-bg-surface))",
            borderBottom: "1px solid color-mix(in srgb, var(--color-status-warning, #d97706) 18%, var(--color-border-divider))",
            fontSize: 12,
            color: "var(--color-text-muted)",
            lineHeight: 1.4,
          }}
        >
          <span>SMS 미연동 — 알림톡만 발송 가능</span>
          <Link
            to="/admin/message/settings"
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--color-status-warning, #d97706)",
              textDecoration: "none",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            연동하기 →
          </Link>
        </div>
      )}
      <Outlet />
    </DomainLayout>
  );
}
