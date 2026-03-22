// PATH: src/features/clinic/components/PreviousWeekImportModal.tsx
// 이전 주 클리닉 불러오기 — 직전 주 세션 목록 → 선택 → 이번 주 동일 요일로 일괄 생성

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import "dayjs/locale/ko";
import { Check, Calendar, Clock, MapPin, Users } from "lucide-react";

import AdminModal from "@/shared/ui/modal/AdminModal";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import api from "@/shared/api/axios";
import { fetchClinicSessionTree } from "../api/clinicSessions.api";
import type { ClinicSessionTreeNode } from "../api/clinicSessions.api";

dayjs.locale("ko");

type Props = {
  open: boolean;
  onClose: () => void;
  currentDate: string; // YYYY-MM-DD — 현재 보고 있는 날짜
};

export default function PreviousWeekImportModal({ open, onClose, currentDate }: Props) {
  const qc = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [creating, setCreating] = useState(false);

  // 이전 주 범위 계산
  const prevWeek = useMemo(() => {
    const current = dayjs(currentDate);
    const startOfWeek = current.startOf("week"); // Sunday
    const prevStart = startOfWeek.subtract(7, "day");
    const prevEnd = prevStart.add(6, "day");
    return {
      start: prevStart.format("YYYY-MM-DD"),
      end: prevEnd.format("YYYY-MM-DD"),
      label: `${prevStart.format("M/D")} ~ ${prevEnd.format("M/D")}`,
    };
  }, [currentDate]);

  // 이전 주 세션 조회
  const prevWeekYM = useMemo(() => {
    const d = dayjs(prevWeek.start);
    return { year: d.year(), month: d.month() + 1 };
  }, [prevWeek.start]);

  const sessionsQ = useQuery({
    queryKey: ["clinic-sessions-tree", prevWeekYM.year, prevWeekYM.month, "import"],
    queryFn: () => fetchClinicSessionTree({ year: prevWeekYM.year, month: prevWeekYM.month }),
    enabled: open,
  });

  // 이전 주 날짜에 해당하는 세션만 필터
  const prevWeekSessions = useMemo(() => {
    if (!sessionsQ.data) return [];
    return sessionsQ.data
      .filter((s) => s.date >= prevWeek.start && s.date <= prevWeek.end)
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time)
      );
  }, [sessionsQ.data, prevWeek]);

  // 날짜별 그룹핑
  const groupedByDate = useMemo(() => {
    const map = new Map<string, ClinicSessionTreeNode[]>();
    for (const s of prevWeekSessions) {
      const list = map.get(s.date) ?? [];
      list.push(s);
      map.set(s.date, list);
    }
    return map;
  }, [prevWeekSessions]);

  const toggleSession = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === prevWeekSessions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(prevWeekSessions.map((s) => s.id)));
    }
  };

  const handleImport = async () => {
    if (selectedIds.size === 0) return;
    setCreating(true);

    try {
      const selected = prevWeekSessions.filter((s) => selectedIds.has(s.id));
      const results = await Promise.allSettled(
        selected.map(async (s) => {
          // 같은 요일 → 이번 주로 매핑
          const prevDay = dayjs(s.date);
          const currentWeekStart = dayjs(currentDate).startOf("week");
          const dayOfWeek = prevDay.day(); // 0=Sun, 1=Mon, ...
          const newDate = currentWeekStart.add(dayOfWeek, "day").format("YYYY-MM-DD");

          return api.post("/clinic/sessions/", {
            title: s.title || "",
            date: newDate,
            start_time: s.start_time.length === 5 ? s.start_time + ":00" : s.start_time,
            duration_minutes: 60, // default, tree doesn't have this
            location: s.location,
            max_participants: s.max_participants ?? 20,
            target_grade: s.target_grade ?? null,
          });
        })
      );

      const ok = results.filter((r) => r.status === "fulfilled").length;
      const fail = results.filter((r) => r.status === "rejected").length;

      qc.invalidateQueries({ queryKey: ["clinic-sessions-tree"] });

      if (fail > 0) {
        feedback.warning(`${ok}건 생성, ${fail}건 실패 (중복 시간/장소 확인)`);
      } else {
        feedback.success(`${ok}건의 클리닉이 생성되었습니다.`);
      }
      setSelectedIds(new Set());
      onClose();
    } catch {
      feedback.error("불러오기에 실패했습니다.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <AdminModal open={open} onClose={onClose} width={560}>
      <div className="clinic-import">
        <div className="clinic-import__header">
          <h2 className="clinic-import__title">이전 주 클리닉 불러오기</h2>
          <p className="clinic-import__subtitle">
            <Calendar size={14} aria-hidden />
            {prevWeek.label} 의 클리닉을 이번 주 동일 요일로 복사합니다
          </p>
        </div>

        <div className="clinic-import__body">
          {sessionsQ.isLoading ? (
            <div className="clinic-import__loading">불러오는 중...</div>
          ) : prevWeekSessions.length === 0 ? (
            <div className="clinic-import__empty">이전 주에 클리닉이 없습니다.</div>
          ) : (
            <>
              <div className="clinic-import__select-all">
                <button
                  type="button"
                  className="clinic-import__select-all-btn"
                  onClick={toggleAll}
                >
                  <span
                    className={`clinic-import__checkbox ${
                      selectedIds.size === prevWeekSessions.length
                        ? "clinic-import__checkbox--checked"
                        : ""
                    }`}
                  >
                    {selectedIds.size === prevWeekSessions.length && (
                      <Check size={12} />
                    )}
                  </span>
                  전체 선택 ({prevWeekSessions.length}건)
                </button>
              </div>

              <div className="clinic-import__list">
                {[...groupedByDate.entries()].map(([date, sessions]) => (
                  <div key={date} className="clinic-import__date-group">
                    <div className="clinic-import__date-label">
                      {dayjs(date).format("M/D (dd)")}
                    </div>
                    {sessions.map((s) => {
                      const checked = selectedIds.has(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          className={`clinic-import__session-item ${
                            checked ? "clinic-import__session-item--selected" : ""
                          }`}
                          onClick={() => toggleSession(s.id)}
                        >
                          <span
                            className={`clinic-import__checkbox ${
                              checked ? "clinic-import__checkbox--checked" : ""
                            }`}
                          >
                            {checked && <Check size={12} />}
                          </span>
                          <div className="clinic-import__session-info">
                            <span className="clinic-import__session-time">
                              <Clock size={12} aria-hidden />
                              {s.start_time.slice(0, 5)}
                            </span>
                            <span className="clinic-import__session-location">
                              <MapPin size={12} aria-hidden />
                              {s.location}
                            </span>
                            {s.title && (
                              <span className="clinic-import__session-title">
                                {s.title}
                              </span>
                            )}
                            <span className="clinic-import__session-capacity">
                              <Users size={12} aria-hidden />
                              {s.max_participants ?? "—"}명
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="clinic-import__footer">
          <Button intent="secondary" size="md" onClick={onClose} disabled={creating}>
            취소
          </Button>
          <Button
            intent="primary"
            size="md"
            onClick={handleImport}
            disabled={selectedIds.size === 0 || creating}
            loading={creating}
          >
            {selectedIds.size > 0 ? `${selectedIds.size}건 불러오기` : "선택하세요"}
          </Button>
        </div>
      </div>
    </AdminModal>
  );
}
