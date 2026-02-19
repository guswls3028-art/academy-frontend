// PATH: src/student/domains/dashboard/components/DashboardScheduleCard.tsx
/**
 * ✅ DashboardScheduleCard
 * - 클리닉 / 상담 일정
 */

import EmptyState from "@/student/shared/ui/layout/EmptyState";
import { formatYmd } from "@/student/shared/utils/date";
import { DashboardScheduleItem } from "../api/dashboard";

export default function DashboardScheduleCard({
  items,
}: {
  items: DashboardScheduleItem[];
}) {
  return (
    <div className="stu-section">
      <div style={{ fontWeight: 900, marginBottom: 12 }}>
        클리닉 · 상담 일정
      </div>

      {items.length === 0 && (
        <EmptyState title="예정된 일정이 없습니다." />
      )}

      {items.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((it) => (
            <div
              key={`${it.type}-${it.id}`}
              style={{
                padding: 12,
                borderRadius: 12,
                background: "var(--stu-card)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontWeight: 800 }}>{it.title}</div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--stu-text-muted)",
                    marginTop: 4,
                  }}
                >
                  {formatYmd(it.date)} ·{" "}
                  {it.type === "CLINIC" ? "클리닉" : "상담"}
                </div>
              </div>
              <span style={{ opacity: 0.4 }}>›</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
