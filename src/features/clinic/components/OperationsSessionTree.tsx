// PATH: src/features/clinic/components/OperationsSessionTree.tsx
// 날짜 선택 트리 — 섹션형 SSOT

import dayjs from "dayjs";
import type { ClinicSessionTreeNode } from "../api/clinicSessions.api";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function buildMonthDays(year: number, month: number) {
  const first = dayjs(`${year}-${String(month).padStart(2, "0")}-01`);
  return Array.from({ length: first.daysInMonth() }, (_, i) =>
    first.add(i, "day").format("YYYY-MM-DD")
  );
}

function groupDaysByWeek(days: string[]) {
  const map = new Map<string, string[]>();
  days.forEach((d) => {
    const monday = dayjs(d).startOf("week").add(1, "day");
    const key = monday.format("YYYY-MM-DD");
    const arr = map.get(key) ?? [];
    arr.push(d);
    map.set(key, arr);
  });
  return Array.from(map.entries()).sort((a, b) => (a[0] > b[0] ? 1 : -1));
}

export default function OperationsSessionTree({
  sessions,
  selectedDay,
  onSelectDay,
  onClear,
  year,
  month,
}: {
  sessions: ClinicSessionTreeNode[];
  selectedDay: string;
  onSelectDay: (date: string) => void;
  onClear: () => void;
  year: number;
  month: number;
}) {
  const byDate = sessions.reduce<Record<string, number>>((acc, s) => {
    acc[s.date] = (acc[s.date] ?? 0) + (s.participant_count ?? 0);
    return acc;
  }, {});

  const days = buildMonthDays(year, month);
  const weeks = groupDaysByWeek(days);
  const monthLabel = `${year}-${String(month).padStart(2, "0")}`;

  return (
    <div className="ds-card-modal clinic-panel w-[320px] shrink-0 overflow-hidden">
      <div className="ds-card-modal__header flex items-center justify-between">
        <div className="ds-card-modal__accent" aria-hidden />
        <div className="ds-card-modal__header-inner">
          <h2 className="ds-card-modal__header-title">날짜</h2>
        </div>
        <div className="ds-card-modal__header-right">
          <button
            type="button"
            className="clinic-btn-reset"
            onClick={onClear}
          >
            초기화
          </button>
        </div>
      </div>
      <div className="ds-card-modal__body p-4 space-y-2 max-h-[680px] overflow-auto">
        <details open>
          <summary className="clinic-tree__summary">{monthLabel}</summary>
          <div className="mt-2 pl-1 space-y-2">
            {weeks.map(([weekKey, weekDays], idx) => (
              <details key={weekKey}>
                <summary className="clinic-tree__summary ml-2">
                  {idx + 1}주차
                </summary>
                <div className="mt-1 pl-2 space-y-1">
                  {weekDays.map((d) => {
                    const count = byDate[d] ?? 0;
                    const active = d === selectedDay;
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => onSelectDay(d)}
                        className={cx(
                          "clinic-tree__day",
                          active && "clinic-tree__day--active"
                        )}
                      >
                        <span>{d}</span>
                        {count > 0 ? (
                          <span className="clinic-tree__day-badge">{count}</span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </details>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}
