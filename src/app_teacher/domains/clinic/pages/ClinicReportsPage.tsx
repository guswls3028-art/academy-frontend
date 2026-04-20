// PATH: src/app_teacher/domains/clinic/pages/ClinicReportsPage.tsx
// 클리닉 보고서 — 월별 캘린더 + 날짜별 세션 수/참가자 수 조회
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { ChevronLeft, ChevronLeft as ChevL, ChevronRight as ChevR } from "@teacher/shared/ui/Icons";
import { Card } from "@teacher/shared/ui/Card";
import { Badge } from "@teacher/shared/ui/Badge";
import { fetchClinicSessions } from "../api";

function monthRange(year: number, month: number) {
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to, lastDay };
}

export default function ClinicReportsPage() {
  const navigate = useNavigate();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { from, to, lastDay } = monthRange(year, month);

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["teacher-clinic-report", year, month],
    queryFn: () => fetchClinicSessions({ date_from: from, date_to: to }),
  });

  // Group sessions by date
  const byDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    (sessions ?? []).forEach((s: any) => {
      const d = s.date ?? s.session_date;
      if (!d) return;
      if (!map[d]) map[d] = [];
      map[d].push(s);
    });
    return map;
  }, [sessions]);

  const total = sessions?.length ?? 0;
  const totalParticipants = (sessions ?? []).reduce((s: number, sess: any) => s + (sess.participants_count ?? sess.participant_count ?? 0), 0);

  const prevMonth = () => {
    if (month === 1) { setYear(year - 1); setMonth(12); }
    else setMonth(month - 1);
    setSelectedDate(null);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(year + 1); setMonth(1); }
    else setMonth(month + 1);
    setSelectedDate(null);
  };

  // Calendar cells
  const firstDay = new Date(year, month - 1, 1).getDay();
  const cells: Array<{ date: string | null; day: number | null }> = [];
  for (let i = 0; i < firstDay; i++) cells.push({ date: null, day: null });
  for (let d = 1; d <= lastDay; d++) {
    cells.push({ date: `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`, day: d });
  }

  const selectedSessions = selectedDate ? byDate[selectedDate] ?? [] : [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 py-0.5">
        <button onClick={() => navigate(-1)} className="flex p-1 cursor-pointer"
          style={{ background: "none", border: "none", color: "var(--tc-text-secondary)" }}>
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-[17px] font-bold flex-1" style={{ color: "var(--tc-text)" }}>클리닉 보고서</h1>
      </div>

      {/* Month nav */}
      <Card style={{ padding: "var(--tc-space-3) var(--tc-space-4)" }}>
        <div className="flex items-center justify-between">
          <button onClick={prevMonth} className="flex p-1.5 cursor-pointer"
            style={{ background: "none", border: "none", color: "var(--tc-text-secondary)" }}>
            <ChevL size={18} />
          </button>
          <span className="text-[15px] font-bold" style={{ color: "var(--tc-text)" }}>{year}년 {month}월</span>
          <button onClick={nextMonth} className="flex p-1.5 cursor-pointer"
            style={{ background: "none", border: "none", color: "var(--tc-text-secondary)" }}>
            <ChevR size={18} />
          </button>
        </div>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-2">
        <div style={{ padding: "12px 14px", borderRadius: "var(--tc-radius)", background: "var(--tc-surface)", border: "1px solid var(--tc-border)" }}>
          <div className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>총 세션</div>
          <div className="text-[18px] font-bold mt-0.5" style={{ color: "var(--tc-text)" }}>{total}</div>
        </div>
        <div style={{ padding: "12px 14px", borderRadius: "var(--tc-radius)", background: "var(--tc-surface)", border: "1px solid var(--tc-border)" }}>
          <div className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>총 참가자</div>
          <div className="text-[18px] font-bold mt-0.5" style={{ color: "var(--tc-text)" }}>{totalParticipants}</div>
        </div>
      </div>

      {/* Calendar grid */}
      <Card style={{ padding: "var(--tc-space-3)" }}>
        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {["일", "월", "화", "수", "목", "금", "토"].map((d, i) => (
            <div key={d} className="text-[10px] text-center font-semibold py-1"
              style={{ color: i === 0 ? "var(--tc-danger)" : i === 6 ? "var(--tc-info)" : "var(--tc-text-muted)" }}>
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((cell, i) => {
            if (!cell.date) return <div key={i} style={{ aspectRatio: "1 / 1" }} />;
            const daySessions = byDate[cell.date] ?? [];
            const count = daySessions.length;
            const isSelected = selectedDate === cell.date;
            const isToday = cell.date === today.toISOString().slice(0, 10);
            return (
              <button key={i} onClick={() => setSelectedDate(cell.date!)} type="button"
                className="cursor-pointer flex flex-col items-center justify-center"
                style={{
                  aspectRatio: "1 / 1",
                  borderRadius: "var(--tc-radius-sm)",
                  border: isSelected ? "1.5px solid var(--tc-primary)" : isToday ? "1px dashed var(--tc-primary)" : "1px solid transparent",
                  background: count > 0 ? "var(--tc-primary-bg)" : "transparent",
                  color: "var(--tc-text)",
                  fontSize: 12,
                  padding: 2,
                }}>
                <span className="font-semibold">{cell.day}</span>
                {count > 0 && (
                  <span className="text-[9px] font-bold" style={{ color: "var(--tc-primary)" }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Selected date details */}
      {selectedDate && (
        <Card style={{ padding: "var(--tc-space-3) var(--tc-space-4)" }}>
          <div className="text-sm font-bold mb-2" style={{ color: "var(--tc-text)" }}>
            {selectedDate} 클리닉
          </div>
          {selectedSessions.length === 0 ? (
            <div className="text-[12px]" style={{ color: "var(--tc-text-muted)" }}>세션 없음</div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {selectedSessions.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between"
                  style={{ padding: "8px 10px", borderRadius: "var(--tc-radius-sm)", background: "var(--tc-surface-soft)" }}>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold truncate" style={{ color: "var(--tc-text)" }}>
                      {s.title ?? "클리닉"}
                    </div>
                    <div className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>
                      {s.start_time?.slice(0, 5) ?? "--"}
                      {s.end_time ? ` ~ ${s.end_time.slice(0, 5)}` : ""}
                      {s.location ? ` · ${s.location}` : ""}
                    </div>
                  </div>
                  <Badge tone="neutral" size="xs">참가 {s.participants_count ?? s.participant_count ?? 0}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {isLoading && !sessions && <EmptyState scope="panel" tone="loading" title="불러오는 중…" />}
    </div>
  );
}
