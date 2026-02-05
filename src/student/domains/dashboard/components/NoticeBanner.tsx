// PATH: src/student/domains/dashboard/components/NoticeBanner.tsx

import { DashboardNotice } from "../api/dashboard";
import EmptyState from "@/student/shared/ui/layout/EmptyState";
import { formatYmd } from "@/student/shared/utils/date";

export default function NoticeBanner({
  notices,
}: {
  notices: DashboardNotice[];
}) {
  if (!notices || notices.length === 0) {
    return <EmptyState title="공지사항이 없습니다." />;
  }

  const first = notices[0];

  return (
    <div className="stu-card">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 6,
        }}
      >
        <div style={{ fontWeight: 900 }}>📣 공지사항</div>
        <div style={{ fontSize: 12, color: "var(--stu-text-muted)" }}>
          {formatYmd(first.created_at ?? null)}
        </div>
      </div>

      <div style={{ fontSize: 14, fontWeight: 700 }}>{first.title}</div>
    </div>
  );
}
