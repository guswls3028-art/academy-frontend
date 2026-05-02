// PATH: src/app_teacher/domains/notifications/pages/NotificationsPage.tsx
// 알림 센터 — 미처리 알림 목록 + 도메인별 도착지 명시
// TodayPage "지금 처리할 일"과 동일 데이터 소스, 헤더 합계 강조 + 처리 경로 라벨로 차별화.
import { useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAdminNotificationCounts } from "@admin/domains/admin-notifications/useAdminNotificationCounts";
import type { AdminNotificationItem } from "@admin/domains/admin-notifications/api";
import { EmptyState } from "@/shared/ui/ds";
import { Badge } from "@teacher/shared/ui/Badge";
import {
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Calendar,
  UserPlus,
  ClipboardList,
  Video,
} from "@teacher/shared/ui/Icons";
import { TEACHER_PENDING_ROUTES } from "../routes";

type ItemType = AdminNotificationItem["type"];

const ICON_MAP: Record<ItemType, ReactNode> = {
  qna: <MessageCircle size={16} />,
  counsel: <MessageCircle size={16} />,
  clinic: <Calendar size={16} />,
  registration_requests: <UserPlus size={16} />,
  submissions: <ClipboardList size={16} />,
  video_failed: <Video size={16} />,
};

const DEST_LABEL: Record<ItemType, string> = {
  qna: "소통에서 답변",
  counsel: "소통에서 답변",
  clinic: "클리닉에서 처리",
  registration_requests: "학생에서 승인",
  submissions: "제출함에서 처리",
  video_failed: "영상에서 재시도",
};

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { items, counts, isLoading } = useAdminNotificationCounts();
  const total = counts?.total ?? 0;

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/teacher", { replace: true });
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2 py-0.5">
        <button
          onClick={handleBack}
          aria-label="뒤로"
          className="flex items-center justify-center cursor-pointer"
          style={{
            background: "none",
            border: "none",
            padding: 6,
            color: "var(--tc-text-secondary)",
            borderRadius: "var(--tc-radius)",
          }}
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-lg font-bold flex-1" style={{ color: "var(--tc-text)" }}>
          알림 센터
        </h1>
        {total > 0 && (
          <Badge tone="danger" pill>
            총 {total}건
          </Badge>
        )}
      </div>

      {/* SSOT 안내: 같은 데이터를 Today에서도 빠르게 확인 가능 */}
      {!isLoading && items.length > 0 && (
        <div className="text-[11px]" style={{ color: "var(--tc-text-muted)", padding: "0 var(--tc-space-1)" }}>
          홈 화면 &lsquo;지금 처리할 일&rsquo;과 동일 데이터입니다. 도메인별 처리 경로를 한눈에 보여줍니다.
        </div>
      )}

      {isLoading ? (
        <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
      ) : items.length > 0 ? (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <button
              key={item.type}
              onClick={() => navigate(TEACHER_PENDING_ROUTES[item.type])}
              className="w-full text-left cursor-pointer rounded-xl"
              style={{
                padding: "var(--tc-space-3) var(--tc-space-4)",
                background: "var(--tc-surface)",
                border: "1px solid var(--tc-border-subtle)",
              }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="flex items-center justify-center shrink-0 rounded-lg"
                  style={{
                    width: 36,
                    height: 36,
                    background: "var(--tc-surface-muted, var(--tc-bg))",
                    color: "var(--tc-text-secondary)",
                  }}
                >
                  {ICON_MAP[item.type]}
                </span>
                <div className="flex-1 min-w-0">
                  <div
                    className="text-sm font-semibold flex items-center gap-2"
                    style={{ color: "var(--tc-text)" }}
                  >
                    <span>{item.label}</span>
                    <Badge tone="danger" pill>
                      {item.count}건
                    </Badge>
                  </div>
                  <div
                    className="text-xs mt-0.5"
                    style={{ color: "var(--tc-text-muted)" }}
                  >
                    {DEST_LABEL[item.type]}
                  </div>
                </div>
                <ChevronRight size={16} style={{ color: "var(--tc-text-muted)" }} />
              </div>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState scope="panel" tone="empty" title="새로운 알림이 없습니다" />
      )}
    </div>
  );
}
