/**
 * 출결 현황 — 본인 누적 카운트 + 최근 차시별 상태
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import StudentPageShell from "@student/shared/ui/pages/StudentPageShell";
import EmptyState from "@student/layout/EmptyState";
import api from "@student/shared/api/student.api";
import { formatYmd } from "@student/shared/utils/date";
import { studentQueryKeys } from "@student/shared/api/queryKeys";
import { richHtmlToPlainText } from "@/shared/utils/richHtml";
import styles from "./AttendancePage.module.css";

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
    can_view_session?: boolean;
  }>;
};

const STATUS_LABEL: Record<string, string> = {
  UNSET: "미입력",
  PRESENT: "출석",
  ONLINE: "온라인",
  SUPPLEMENT: "보강",
  LATE: "지각",
  EARLY_LEAVE: "조퇴",
  ABSENT: "결석",
  RUNAWAY: "이탈",
  MATERIAL: "자료",
  INACTIVE: "부재",
  SECESSION: "퇴원",
};

type AttendanceTone = "success" | "warn" | "danger" | "neutral";

const STATUS_TONE: Partial<Record<string, AttendanceTone>> = {
  PRESENT: "success",
  ONLINE: "success",
  SUPPLEMENT: "success",
  LATE: "warn",
  EARLY_LEAVE: "warn",
  ABSENT: "danger",
  RUNAWAY: "danger",
};

async function fetchAttendanceSummary(): Promise<AttendanceSummary> {
  const res = await api.get<AttendanceSummary>("/student/attendance/summary/");
  return {
    ...res.data,
    recent: Array.isArray(res.data.recent)
      ? res.data.recent.map((row) => ({
          ...row,
          lecture_title: richHtmlToPlainText(row.lecture_title),
          session_title: richHtmlToPlainText(row.session_title),
        }))
      : [],
  };
}

export default function AttendancePage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: studentQueryKeys.attendanceSummary,
    queryFn: fetchAttendanceSummary,
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <StudentPageShell title="출결 현황">
        <div className={styles.loadingStack}>
          <div className={`stu-skel ${styles.loadingSummary}`} />
          <div className={`stu-skel ${styles.loadingList}`} />
        </div>
      </StudentPageShell>
    );
  }

  if (isError || !data) {
    return (
      <StudentPageShell title="출결 현황">
        <EmptyState
          title="출결 정보를 불러오지 못했습니다"
          description="잠시 후 다시 시도해 주세요."
          onRetry={() => refetch()}
        />
      </StudentPageShell>
    );
  }

  const { summary, recent } = data;
  const hasAny = summary.total > 0;

  return (
    <StudentPageShell title="출결 현황" description="누적 출결과 최근 차시 상태입니다. 출석은 현장·온라인·보강을 합산하며, 전체에는 미입력·자료·부재·퇴원 기록도 포함됩니다." descriptionMode="help">
      {!hasAny ? (
        <EmptyState
          title="출결 기록이 없습니다"
          description="수업이 시작되면 차시별 출결이 표시됩니다."
        />
      ) : (
        <div className={styles.contentStack}>
          {/* KPI */}
          <section className={`stu-panel ${styles.kpiGrid}`}>
            <KpiCell label="전체" value={summary.total} />
            <KpiCell label="출석" value={summary.present} tone="success" />
            <KpiCell label="지각·조퇴" value={summary.late + summary.early_leave} tone="warn" />
            <KpiCell label="결석·이탈" value={summary.absent + summary.runaway} tone="danger" />
          </section>

          {/* 최근 출결 */}
          <section>
            <h3 className={styles.sectionTitle}>
              최근 출결 ({recent.length})
            </h3>
            <div className={styles.recentList}>
              {recent.map((row) => {
                const content = <>
                  <div className={styles.recentContent}>
                    <div className={styles.recentTitle}>
                      {row.lecture_title || row.session_title || "차시"}
                    </div>
                    <div className={`stu-muted ${styles.recentMeta}`}>
                      {row.session_title} · {row.date ? formatYmd(row.date) : "-"}
                      {row.can_view_session !== true && <span className={styles.historyHint}>출결 이력</span>}
                    </div>
                  </div>
                  <span
                    className={styles.statusPill}
                    data-tone={STATUS_TONE[row.status] ?? "neutral"}
                  >
                    {STATUS_LABEL[row.status] || row.status}
                  </span>
                </>;
                return row.can_view_session === true ? (
                  <Link key={row.session_id} to={`/student/sessions/${row.session_id}`}
                    className={`stu-panel stu-panel--pressable ${styles.recentLink}`}>
                    {content}
                  </Link>
                ) : (
                  <div key={row.session_id} className={`stu-panel ${styles.recentLink}`}>
                    {content}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </StudentPageShell>
  );
}

function KpiCell({ label, value, tone = "neutral" }: { label: string; value: number; tone?: AttendanceTone }) {
  return (
    <div className={styles.kpiCell}>
      <div className={styles.kpiValue} data-tone={tone}>{value}</div>
      <div className={styles.kpiLabel}>{label}</div>
    </div>
  );
}
