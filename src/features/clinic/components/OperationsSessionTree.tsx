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
    <div className="clinic-panel w-[320px] shrink-0 overflow-hidden">
      <div className="clinic-panel__header flex items-center justify-between">
        <h2 className="clinic-panel__title">날짜</h2>
        <button
          type="button"
          className="text-xs px-2 py-1 rounded-md border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] hover:bg-[var(--color-bg-surface-hover)] text-[var(--color-text-primary)]"
          onClick={onClear}
        >
          초기화
        </button>
      </div>
      <div className="clinic-panel__body p-3 space-y-2 max-h-[680px] overflow-auto">
        <details open>
          <summary className="cursor-pointer font-semibold text-[var(--color-text-primary)]">
            {monthLabel}
          </summary>
          <div className="mt-2 pl-2 space-y-2">
            {weeks.map(([weekKey, weekDays], idx) => (
              <details key={weekKey}>
                <summary className="cursor-pointer text-sm font-semibold text-[var(--color-text-primary)]">
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
                          "w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                          active
                            ? "border-[var(--color-primary)] bg-[var(--color-bg-surface-hover)] text-[var(--color-primary)]"
                            : "border-[var(--color-border-divider)] bg-transparent hover:bg-[var(--color-bg-surface-hover)] text-[var(--color-text-primary)]"
                        )}
                      >
                        <span className="flex items-center justify-between">
                          {d}
                          {count > 0 && (
                            <span className="text-xs font-semibold text-[var(--color-primary)]">
                              {count}
                            </span>
                          )}
                        </span>
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
