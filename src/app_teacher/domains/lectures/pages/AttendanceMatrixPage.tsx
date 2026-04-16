// PATH: src/app_teacher/domains/lectures/pages/AttendanceMatrixPage.tsx
// 출석 매트릭스 — 모바일 개량: 학생별 카드 + 가로 스크롤 세션 컬럼
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { ChevronLeft, Download } from "@teacher/shared/ui/Icons";
import { Card } from "@teacher/shared/ui/Card";
import { Badge } from "@teacher/shared/ui/Badge";
import { downloadAttendanceExcel } from "../api";
import api from "@/shared/api/axios";

export default function AttendanceMatrixPage() {
  const { lectureId } = useParams<{ lectureId: string }>();
  const navigate = useNavigate();
  const lid = Number(lectureId);

  const { data: matrix, isLoading } = useQuery({
    queryKey: ["attendance-matrix", lid],
    queryFn: async () => {
      const res = await api.get(`/lectures/lectures/${lid}/attendance-matrix/`);
      return res.data;
    },
    enabled: Number.isFinite(lid),
  });

  if (isLoading) return <EmptyState scope="panel" tone="loading" title="불러오는 중..." />;

  const sessions: any[] = matrix?.sessions ?? [];
  const students: any[] = matrix?.students ?? [];

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2 py-0.5">
        <button onClick={() => navigate(-1)} className="flex p-1 cursor-pointer"
          style={{ background: "none", border: "none", color: "var(--tc-text-secondary)" }}>
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-[17px] font-bold flex-1" style={{ color: "var(--tc-text)" }}>출석 현황</h1>
        <button onClick={() => downloadAttendanceExcel(lid).catch(() => {})}
          className="flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
          style={{ padding: "5px 10px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border)", background: "var(--tc-surface)", color: "var(--tc-text-secondary)" }}>
          <Download size={12} /> 엑셀
        </button>
      </div>

      {/* Legend */}
      <div className="flex gap-2 flex-wrap text-[10px]" style={{ color: "var(--tc-text-muted)" }}>
        <span style={{ color: "var(--tc-success)" }}>● 출석</span>
        <span style={{ color: "var(--tc-danger)" }}>● 결석</span>
        <span style={{ color: "var(--tc-warn)" }}>● 지각</span>
        <span>○ 미기록</span>
      </div>

      {/* Session headers — fixed reference */}
      {sessions.length > 0 && (
        <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" }}>
          <div className="flex gap-1 pb-1" style={{ minWidth: sessions.length * 44 }}>
            <div className="w-20 shrink-0 text-[10px] font-bold" style={{ color: "var(--tc-text-muted)" }}>학생</div>
            {sessions.map((s: any, i: number) => (
              <div key={s.id ?? i} className="w-10 shrink-0 text-center text-[9px] font-semibold"
                style={{ color: "var(--tc-text-muted)" }}>
                {s.order ?? i + 1}차
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Student rows */}
      {students.length > 0 ? (
        <div className="flex flex-col gap-0.5">
          {students.map((student: any) => (
            <div key={student.id ?? student.student_id} className="overflow-x-auto"
              style={{ WebkitOverflowScrolling: "touch" }}>
              <div className="flex items-center gap-1"
                style={{ minWidth: sessions.length * 44, padding: "6px 0", borderBottom: "1px solid var(--tc-border-subtle)" }}>
                <div className="w-20 shrink-0 text-[12px] font-medium truncate" style={{ color: "var(--tc-text)" }}>
                  {student.name ?? student.student_name ?? "이름"}
                </div>
                {sessions.map((session: any, si: number) => {
                  const att = student.attendances?.[session.id] ?? student.attendance?.[si];
                  const status = att?.status ?? att;
                  return (
                    <div key={session.id ?? si}
                      className="w-10 h-7 shrink-0 flex items-center justify-center rounded text-[10px] font-bold"
                      style={{
                        background: statusBg(status),
                        color: statusColor(status),
                      }}>
                      {statusLabel(status)}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState scope="panel" tone="empty" title="출석 데이터가 없습니다" />
      )}

      {/* Summary */}
      {students.length > 0 && (
        <Card style={{ padding: "var(--tc-space-3)" }}>
          <div className="text-[12px]" style={{ color: "var(--tc-text-muted)" }}>
            학생 {students.length}명 · 차시 {sessions.length}개
          </div>
        </Card>
      )}
    </div>
  );
}

function statusColor(status: string | undefined): string {
  switch (status) {
    case "PRESENT": case "ONLINE": return "var(--tc-success)";
    case "ABSENT": return "var(--tc-danger)";
    case "LATE": return "var(--tc-warn)";
    default: return "var(--tc-text-muted)";
  }
}

function statusBg(status: string | undefined): string {
  switch (status) {
    case "PRESENT": case "ONLINE": return "var(--tc-success-bg)";
    case "ABSENT": return "var(--tc-danger-bg)";
    case "LATE": return "var(--tc-warn-bg)";
    default: return "var(--tc-surface-soft)";
  }
}

function statusLabel(status: string | undefined): string {
  switch (status) {
    case "PRESENT": return "출";
    case "ONLINE": return "온";
    case "ABSENT": return "결";
    case "LATE": return "지";
    case "EARLY_LEAVE": return "조";
    case "SUPPLEMENT": return "보";
    default: return "·";
  }
}
