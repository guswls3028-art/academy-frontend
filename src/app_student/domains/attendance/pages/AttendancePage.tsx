/**
 * 출결 현황 — 본인 누적 카운트 + 최근 차시별 상태
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import StudentPageShell from "@student/shared/ui/pages/StudentPageShell";
import EmptyState from "@student/layout/EmptyState";
import api from "@student/shared/api/student.api";
import { formatYmd } from "@student/shared/utils/date";

type AttendanceSummary = {
  summary: {
    total: number;
    present: number;
    absent: number;
    late: number;
    early_leave: number;
    runaway: number;
  };
  recent: Array<{
    session_id: number;
    lecture_title: string;
    session_title: string;
    date: string | null;
    status: string;
  }>;
};

const STATUS_LABEL: Record<string, string> = {
  PRESENT: "출석",
  ONLINE: "온라인",
  SUPPLEMENT: "보강",
  LATE: "지각",
  EARLY_LEAVE: "조퇴",
  ABSENT: "결석",
  RUNAWAY: "출튀",
  MATERIAL: "자료",
  INACTIVE: "부재",
  SECESSION: "탈퇴",
};

const STATUS_TONE: Record<string, string> = {
  PRESENT: "var(--stu-success)",
  ONLINE: "var(--stu-success)",
  SUPPLEMENT: "var(--stu-success)",
  LATE: "var(--stu-warn)",
  EARLY_LEAVE: "var(--stu-warn)",
  ABSENT: "var(--stu-danger)",
  RUNAWAY: "var(--stu-danger)",
};

async function fetchAttendanceSummary(): Promise<AttendanceSummary> {
  const res = await api.get<AttendanceSummary>("/student/attendance/summary/");
  return res.data;
}

export default function AttendancePage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["student", "attendance", "summary"],
    queryFn: fetchAttendanceSummary,
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <StudentPageShell title="출결 현황">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-3)" }}>
          <div className="stu-skel" style={{ height: 88, borderRadius: "var(--stu-radius)" }} />
          <div className="stu-skel" style={{ height: 240, borderRadius: "var(--stu-radius)" }} />
        </div>
      </StudentPageShell>
    );
  }

  if (isError || !data) {
    return (
      <StudentPageShell title="출결 현황">
        <EmptyState title="출결 정보를 불러오지 못했습니다" description="잠시 후 다시 시도해 주세요." />
      </StudentPageShell>
    );
  }

  const { summary, recent } = data;
  const hasAny = summary.total > 0;

  return (
    <StudentPageShell title="출결 현황" description="누적 출결과 최근 차시 상태입니다.">
      {!hasAny ? (
        <EmptyState
          title="출결 기록이 없습니다"
          description="수업이 시작되면 차시별 출결이 표시됩니다."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-4)" }}>
          {/* KPI */}
          <section
            className="stu-panel"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "var(--stu-space-2)",
              padding: "var(--stu-space-4)",
            }}
          >
            <KpiCell label="전체" value={summary.total} />
            <KpiCell label="출석" value={summary.present} color="var(--stu-success)" />
            <KpiCell label="지각" value={summary.late + summary.early_leave} color="var(--stu-warn)" />
            <KpiCell label="결석" value={summary.absent + summary.runaway} color="var(--stu-danger)" />
          </section>

          {/* 최근 출결 */}
          <section>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: "var(--stu-space-3)" }}>
              최근 출결 ({recent.length})
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-2)" }}>
              {recent.map((row) => (
                <Link
                  key={row.session_id}
                  to={`/student/sessions/${row.session_id}`}
                  className="stu-panel stu-panel--pressable"
                  style={{ textDecoration: "none", color: "inherit", display: "flex", alignItems: "center", gap: "var(--stu-space-3)" }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {row.lecture_title || row.session_title || "차시"}
                    </div>
                    <div className="stu-muted" style={{ fontSize: 12 }}>
                      {row.session_title} · {row.date ? formatYmd(row.date) : "-"}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      padding: "4px 10px",
                      borderRadius: 999,
                      background: STATUS_TONE[row.status] ? `${STATUS_TONE[row.status]}22` : "var(--stu-surface-soft)",
                      color: STATUS_TONE[row.status] || "var(--stu-text-muted)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {STATUS_LABEL[row.status] || row.status}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      )}
    </StudentPageShell>
  );
}

function KpiCell({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: color || "var(--stu-text)" }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--stu-text-muted)" }}>{label}</div>
    </div>
  );
}
