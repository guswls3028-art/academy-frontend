// src/student/domains/dashboard/components/NoticeBanner.tsx
/**
 * ✅ NoticeBanner (MVP)
 * - 공지 1개만 보여주는 형태
 * - 판단/필터링 ❌
 */

import EmptyState from "@/student/shared/components/EmptyState";
import { DashboardNotice } from "@/student/domains/dashboard/api/dashboard";
import { formatYmd } from "@/student/shared/utils/date";

export default function NoticeBanner({ notices }: { notices: DashboardNotice[] }) {
  if (!notices.length) {
    return <EmptyState title="공지사항이 없습니다." />;
  }

  const first = notices[0];

  return (
    <div
      style={{
        border: "1px solid #eee",
        borderRadius: 12,
        background: "#fff",
        padding: 14,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontWeight: 800 }}>📣 공지사항</div>
        <div style={{ fontSize: 12, color: "#777" }}>
          {formatYmd(first.created_at ?? null)}
        </div>
      </div>
      <div style={{ marginTop: 8, color: "#333" }}>{first.title}</div>
    </div>
  );
}
