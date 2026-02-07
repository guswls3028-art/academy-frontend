// PATH: src/features/lectures/pages/lectures/LectureReportPage.tsx

import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { PageHeader, Section, Panel } from "@/shared/ui/ds";

import {
  fetchLectureReport,
  LectureReportResponse,
} from "../../api/report";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

const STATUS_LABEL_MAP: Record<string, string> = {
  PRESENT: "현장",
  LATE: "지각",
  ONLINE: "영상",
  SUPPLEMENT: "보강",
  EARLY_LEAVE: "조퇴",
  ABSENT: "결석",
  RUNAWAY: "출튀",
  MATERIAL: "자료",
  INACTIVE: "부재",
  SECESSION: "퇴원",
};

export default function LectureReportPage() {
  const { lectureId } = useParams<{ lectureId: string }>();
  const lectureIdNum = Number(lectureId);

  const { data, isLoading, error } = useQuery<LectureReportResponse>({
    queryKey: ["lecture-report", lectureIdNum],
    queryFn: () => fetchLectureReport(lectureIdNum),
    enabled: Number.isFinite(lectureIdNum),
  });

  if (!Number.isFinite(lectureIdNum)) {
    return (
      <div className="p-6 text-sm text-red-500">잘못된 강의 ID</div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 text-sm text-[var(--text-muted)]">
        로딩중…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 text-sm text-red-500">
        리포트 데이터를 불러오지 못했습니다.
      </div>
    );
  }

  const { lecture, summary, attendance_by_status, students } = data;

  const attendanceChartData = Object.entries(attendance_by_status).map(
    ([key, value]) => ({
      status: STATUS_LABEL_MAP[key] ?? key,
      count: value as number,
    })
  );

  return (
    <Section>
      <PageHeader
        title={`강의 리포트 — ${lecture.title}`}
        actions={
          <Link
            to=".."
            relative="path"
            className="rounded border border-[var(--border-divider)] px-3 py-2 text-sm"
          >
            강의 상세
          </Link>
        }
      />

      <Panel>
        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <SummaryCard label="총 수강 학생" value={summary.total_students} />
          <SummaryCard label="차시 수" value={summary.total_sessions} />
          <SummaryCard label="영상 개수" value={summary.total_videos} />
          <SummaryCard
            label="평균 영상 진도율"
            value={`${(summary.avg_video_progress * 100).toFixed(0)}%`}
            sub={`완료 학생 ${summary.completed_students}명`}
          />
        </div>

        <div className="rounded border bg-white p-4">
          <div className="mb-2 text-sm font-semibold">
            출석 상태 분포
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={attendanceChartData}>
                <XAxis dataKey="status" interval={0} angle={-20} height={60} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded border">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-1 text-left">학생</th>
                <th className="px-2 py-1 text-right">평균 진도</th>
                <th className="px-2 py-1 text-center">완료</th>
                <th className="px-2 py-1 text-center">마지막 출석</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.enrollment} className="border-t">
                  <td className="px-2 py-1">{s.student_name}</td>
                  <td className="px-2 py-1 text-right">
                    {(s.avg_progress * 100).toFixed(0)}%
                  </td>
                  <td className="px-2 py-1 text-center">
                    {s.completed_videos}/{s.total_videos}
                  </td>
                  <td className="px-2 py-1 text-center">
                    {STATUS_LABEL_MAP[s.last_attendance_status ?? ""] ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </Section>
  );
}

function SummaryCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: number | string;
  sub?: string;
}) {
  return (
    <div className="rounded border bg-white p-4 text-sm">
      <div className="text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {sub && <div className="mt-1 text-xs text-gray-400">{sub}</div>}
    </div>
  );
}
