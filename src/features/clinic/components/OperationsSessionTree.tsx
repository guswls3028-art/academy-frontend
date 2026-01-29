// PATH: src/features/clinic/components/OperationsSessionTree.tsx
import dayjs from "dayjs";
import type { ClinicSessionTreeNode } from "../api/clinicSessions.api";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function buildMonthDays(year: number, month: number) {
  const first = dayjs(`${year}-${String(month).padStart(2, "0")}-01`);
  const daysInMonth = first.daysInMonth();
  return Array.from({ length: daysInMonth }, (_, i) =>
    first.add(i, "day").format("YYYY-MM-DD")
  );
}

// 월요일 시작 주차 묶기
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
    <div className="w-[320px] shrink-0 rounded-2xl border bg-[var(--bg-surface)] overflow-hidden">
      <div className="px-4 py-3 border-b bg-[var(--bg-surface-soft)] flex items-center justify-between">
        <div className="text-sm font-semibold">날짜 선택</div>
        <button
          type="button"
          className="text-xs px-2 py-1 rounded border"
          onClick={onClear}
        >
          초기화
        </button>
      </div>

      <div className="p-3 space-y-2 max-h-[680px] overflow-auto">
        <details open>
          <summary className="cursor-pointer font-semibold">
            {monthLabel}
          </summary>

          <div className="mt-2 pl-2 space-y-2">
            {weeks.map(([weekKey, weekDays], idx) => (
              <details key={weekKey}>
                <summary className="cursor-pointer text-sm font-semibold">
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
                          "w-full rounded-lg border px-3 py-2 text-left text-sm",
                          active
                            ? "border-[var(--color-primary)] bg-[var(--bg-surface-soft)]"
                            : count > 0
                            ? "border-[color-mix(in_srgb,var(--color-primary)_30%,var(--border-divider))]"
                            : "border-[var(--border-divider)]"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span>{d}</span>
                          {count > 0 && (
                            <span className="text-xs font-semibold text-[var(--color-primary)]">
                              {count}
                            </span>
                          )}
                        </div>
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
