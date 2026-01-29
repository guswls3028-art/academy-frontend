// PATH: src/features/clinic/components/home/ClinicWeeklySummary.tsx
import dayjs from "dayjs";
import { ClinicParticipant } from "../../api/clinicParticipants.api";

type SessionBlock = {
  sessionId: number;
  start: string;
  end?: string;
  count: number;
};

function buildWeek(from: string) {
  return Array.from({ length: 7 }, (_, i) =>
    dayjs(from).add(i, "day").format("YYYY-MM-DD")
  );
}

function buildSessionBlocks(rows: ClinicParticipant[]): SessionBlock[] {
  const bySession = new Map<number, ClinicParticipant[]>();

  rows.forEach((r) => {
    if (!r.session) return;
    bySession.set(r.session, [...(bySession.get(r.session) ?? []), r]);
  });

  const blocks: SessionBlock[] = [];

  for (const [sessionId, items] of bySession.entries()) {
    const first = items[0];
    const start = (first.session_start_time || "").slice(0, 5);
    const end = first.session_end_time
      ? first.session_end_time.slice(0, 5)
      : undefined;

    blocks.push({
      sessionId,
      start,
      end,
      count: items.length,
    });
  }

  blocks.sort((a, b) => (a.start > b.start ? 1 : -1));
  return blocks;
}

export default function ClinicWeeklySummary({
  from,
  to,
  rows,
  loading,
  onSelectDay,
}: {
  from: string;
  to: string;
  rows: ClinicParticipant[];
  loading: boolean;
  onSelectDay: (date: string) => void;
}) {
  const days = buildWeek(from);

  const rowsByDay: Record<string, ClinicParticipant[]> = Object.fromEntries(
    days.map((d) => [d, []])
  );

  rows.forEach((r) => {
    if (rowsByDay[r.session_date]) {
      rowsByDay[r.session_date].push(r);
    }
  });

  return (
    <div className="rounded-2xl border bg-[var(--bg-surface)] overflow-hidden">
      <div className="px-5 py-4 border-b bg-[var(--bg-surface-soft)]">
        <div className="text-sm font-semibold">주간 요약</div>
        <div className="text-xs text-[var(--text-muted)]">
          {from} ~ {to}
        </div>
      </div>

      <div className="p-5">
        {loading && (
          <div className="text-xs text-[var(--text-muted)]">불러오는 중...</div>
        )}

        {!loading && (
          <div className="grid grid-cols-7 gap-2">
            {days.map((d) => {
              const dayRows = rowsByDay[d];
              const blocks = buildSessionBlocks(dayRows);
              const sessionCount = blocks.length;
              const participantCount = dayRows.length;
              const dow = dayjs(d).format("dd");

              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => onSelectDay(d)}
                  className="rounded-xl border border-[var(--border-divider)] bg-[var(--bg-surface-soft)] p-3 text-left hover:bg-[var(--bg-surface)]"
                >
                  {/* 요일 헤더 */}
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">{dow}</div>
                    <div className="text-[11px] text-[var(--text-muted)]">
                      {sessionCount}회 | {participantCount}명
                    </div>
                  </div>

                  {/* 세션 타임 블록 */}
                  <div className="mt-2 space-y-1">
                    {blocks.map((b) => (
                      <div
                        key={b.sessionId}
                        className="text-[11px] rounded-lg border border-[var(--border-divider)] bg-[var(--bg-surface)] px-2 py-1 font-medium"
                      >
                        [{b.start}
                        {b.end ? ` ~ ${b.end}` : ""} | {b.count}명]
                      </div>
                    ))}

                    {blocks.length === 0 && (
                      <div className="text-[11px] text-[var(--text-muted)]">
                        일정 없음
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="px-5 pb-4">
        <div className="text-[11px] text-[var(--text-muted)]">
          * 날짜 클릭 시 해당 일자의 운영 화면으로 이동합니다.
        </div>
      </div>
    </div>
  );
}
