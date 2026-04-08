// PATH: src/features/clinic/components/PreviousWeekImportModal.tsx
// 이전 주 클리닉 불러오기 — 직전 주 세션 목록 → 선택 → 이번 주 동일 요일로 일괄 생성

import { useEffect, useMemo, useState } from "react";
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

  // 모달 열릴 때 선택 초기화 (이전 선택 잔존 방지)
  useEffect(() => {
    if (open) { setSelectedIds(new Set()); setCreating(false); }
  }, [open]);

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

  // 이전 주 + 이번 주 세션 조회 (중복 감지용)
  const prevWeekYM = useMemo(() => {
    const d = dayjs(prevWeek.start);
    return { year: d.year(), month: d.month() + 1 };
  }, [prevWeek.start]);

  const currentWeekYM = useMemo(() => {
    const d = dayjs(currentDate);
    return { year: d.year(), month: d.month() + 1 };
  }, [currentDate]);

  const sessionsQ = useQuery({
    queryKey: ["clinic-sessions-tree", prevWeekYM.year, prevWeekYM.month, "import"],
    queryFn: () => fetchClinicSessionTree({ year: prevWeekYM.year, month: prevWeekYM.month }),
    enabled: open,
  });

  // 이번 주 세션도 조회 (다른 월일 수 있으므로 별도)
  const currentWeekSessionsQ = useQuery({
    queryKey: ["clinic-sessions-tree", currentWeekYM.year, currentWeekYM.month, "import-current"],
    queryFn: () => fetchClinicSessionTree({ year: currentWeekYM.year, month: currentWeekYM.month }),
    enabled: open,
  });

  // 이번 주 기존 세션의 날짜+시간+장소 키 세트 (중복 감지용)
  const currentWeekKeys = useMemo(() => {
    const keys = new Set<string>();
    const weekStart = dayjs(currentDate).startOf("week");
    const weekEnd = weekStart.add(6, "day").format("YYYY-MM-DD");
    const weekStartStr = weekStart.format("YYYY-MM-DD");
    for (const s of currentWeekSessionsQ.data ?? []) {
      if (s.date >= weekStartStr && s.date <= weekEnd) {
        keys.add(`${s.date}|${s.start_time.slice(0, 5)}|${s.location}`);
      }
    }
    // 같은 월 데이터도 포함
    for (const s of sessionsQ.data ?? []) {
      if (s.date >= weekStartStr && s.date <= weekEnd) {
        keys.add(`${s.date}|${s.start_time.slice(0, 5)}|${s.location}`);
      }
    }
    return keys;
  }, [currentWeekSessionsQ.data, sessionsQ.data, currentDate]);

  // 이전 주 세션 → 이번 주 매핑 날짜 계산 + 중복 여부
  const mapToCurrentWeek = (sessionDate: string) => {
    const prevDay = dayjs(sessionDate);
    const currentWeekStart = dayjs(currentDate).startOf("week");
    return currentWeekStart.add(prevDay.day(), "day").format("YYYY-MM-DD");
  };

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

  // 세션별 중복 여부
  const isDuplicate = (s: ClinicSessionTreeNode) => {
    const newDate = mapToCurrentWeek(s.date);
    const key = `${newDate}|${s.start_time.slice(0, 5)}|${s.location}`;
    return currentWeekKeys.has(key);
  };

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
      const toCreate = selected.filter((s) => !isDuplicate(s));
      const skipped = selected.length - toCreate.length;

      if (toCreate.length === 0) {
        feedback.warning("선택한 클리닉이 모두 이번 주에 이미 있습니다.");
        setCreating(false);
        return;
      }

      const results = await Promise.allSettled(
        toCreate.map(async (s) => {
          const newDate = mapToCurrentWeek(s.date);
          return api.post("/clinic/sessions/", {
            title: s.title || "",
            date: newDate,
            start_time: s.start_time.length === 5 ? s.start_time + ":00" : s.start_time,
            duration_minutes: 60,
            location: s.location,
            max_participants: s.max_participants ?? 20,
            target_grade: s.target_grade ?? null,
          });
        })
      );

      const ok = results.filter((r) => r.status === "fulfilled").length;
      const fail = results.filter((r) => r.status === "rejected").length;

      qc.invalidateQueries({ queryKey: ["clinic-sessions-tree"] });

      if (ok > 0 && fail === 0 && skipped === 0) {
        feedback.success(`${ok}건의 클리닉이 생성되었습니다.`);
      } else if (ok > 0) {
        const parts = [`${ok}건 생성`];
        if (skipped > 0) parts.push(`${skipped}건 중복 건너뜀`);
        if (fail > 0) parts.push(`${fail}건 실패`);
        feedback.warning(parts.join(", "));
      } else {
        feedback.error("클리닉 생성에 실패했습니다. 시간/장소가 중복되었는지 확인하세요.");
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
                      const dup = isDuplicate(s);
                      const mappedDate = mapToCurrentWeek(s.date);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          className={`clinic-import__session-item ${
                            checked ? "clinic-import__session-item--selected" : ""
                          } ${dup ? "clinic-import__session-item--duplicate" : ""}`}
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
                            <span className="clinic-import__session-mapped">
                              → {dayjs(mappedDate).format("M/D(dd)")}
                              {dup && <span className="clinic-import__dup-badge">이미 있음</span>}
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
