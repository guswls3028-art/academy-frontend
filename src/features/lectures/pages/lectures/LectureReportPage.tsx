// PATH: src/features/lectures/pages/lectures/LectureReportPage.tsx
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { fetchLectureReport, type LectureReportResponse } from "@/features/lectures/api/report";

const TH_STYLE = {
  background: "color-mix(in srgb, var(--color-primary) 12%, var(--bg-surface))",
  color: "var(--color-text-muted)",
};

export default function LectureReportPage() {
  const { lectureId } = useParams<{ lectureId: string }>();
  const lectureIdNum = Number(lectureId);

  const { data, isLoading } = useQuery<LectureReportResponse>({
    queryKey: ["lecture-report", lectureIdNum],
    queryFn: () => fetchLectureReport(lectureIdNum),
    enabled: Number.isFinite(lectureIdNum),
  });

  if (isLoading) return <EmptyState scope="panel" tone="loading" title="불러오는 중…" />;
  if (!data)
    return (
      <EmptyState
        scope="panel"
        title="리포트 데이터가 없습니다."
        description="강의 데이터가 충분하지 않습니다."
      />
    );

  const students = data.students ?? [];

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* 요약 (카드 톤 통일) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {[
          { label: "전체 수강생", value: data.summary?.total_students ?? "-" },
          { label: "전체 차시", value: data.summary?.total_sessions ?? "-" },
          { label: "평균 진도", value: `${data.summary?.avg_video_progress ?? 0}%` },
        ].map((m) => (
          <div
            key={m.label}
            style={{
              borderRadius: 14,
              border: "1px solid var(--color-border-divider)",
              background: "var(--color-bg-surface)",
              padding: 14,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 900, color: "var(--color-text-muted)" }}>{m.label}</div>
            <div style={{ marginTop: 4, fontSize: 20, fontWeight: 950, color: "var(--color-text-primary)" }}>
              {m.value}
            </div>
          </div>
        ))}
      </div>

      {/* 학생별 */}
      {!students.length ? (
        <EmptyState mode="embedded" scope="panel" title="학생 데이터가 없습니다." />
      ) : (
        <div style={{ overflow: "hidden", borderRadius: 14, border: "1px solid var(--color-border-divider)" }}>
          <table className="w-full" style={{ tableLayout: "fixed" }}>
            <thead>
              <tr>
                <th
                  className="px-4 py-3 text-sm font-semibold border-b border-[var(--color-border-divider)]"
                  style={{ textAlign: "left", ...TH_STYLE }}
                >
                  이름
                </th>
                <th
                  className="px-4 py-3 text-sm font-semibold border-b border-[var(--color-border-divider)]"
                  style={{ textAlign: "center", width: 160, ...TH_STYLE }}
                >
                  평균 진도
                </th>
                <th
                  className="px-4 py-3 text-sm font-semibold border-b border-[var(--color-border-divider)]"
                  style={{ textAlign: "center", width: 160, ...TH_STYLE }}
                >
                  최근 출결
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[var(--color-border-divider)]">
              {students.map((s) => (
                <tr key={s.student_id} className="hover:bg-[var(--color-bg-surface-soft)]">
                  <td className="px-4 py-3 text-left text-[15px] font-bold text-[var(--color-text-primary)] truncate">
                    {s.student_name}
                  </td>
                  <td className="px-4 py-3 text-center text-[14px] text-[var(--color-text-secondary)]">
                    {s.avg_progress ?? 0}%
                  </td>
                  <td className="px-4 py-3 text-center text-[13px] font-semibold text-[var(--color-text-muted)]">
                    {s.last_attendance_status ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
