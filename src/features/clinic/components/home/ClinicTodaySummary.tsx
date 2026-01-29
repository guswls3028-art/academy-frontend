// PATH: src/features/clinic/components/home/ClinicTodaySummary.tsx
import { ClinicParticipant } from "../../api/clinicParticipants.api";

function groupBySession(rows: ClinicParticipant[]) {
  const map = new Map<number, ClinicParticipant[]>();
  rows.forEach((r) => {
    if (!r.session) return;
    map.set(r.session, [...(map.get(r.session) ?? []), r]);
  });

  const items = Array.from(map.entries()).map(([sessionId, rs]) => {
    const first = rs[0];
    const time = (first?.session_start_time || "").slice(0, 5) || "-";
    const end = first?.session_end_time ? first.session_end_time.slice(0, 5) : "";
    const location = first?.session_location || "";
    const booked = rs.filter((x) => x.status === "booked").length;
    const noShow = rs.filter((x) => x.status === "no_show").length;

    return {
      sessionId,
      time,
      end,
      location,
      total: rs.length,
      booked,
      noShow,
    };
  });

  items.sort((a, b) => (a.time > b.time ? 1 : a.time < b.time ? -1 : 0));
  return items;
}

export default function ClinicTodaySummary({
  date,
  rows,
  loading,
  onGoOperations,
  onGoBookings,
}: {
  date: string;
  rows: ClinicParticipant[];
  loading: boolean;
  onGoOperations: () => void;
  onGoBookings: () => void;
}) {
  const sessions = groupBySession(rows);

  const booked = rows.filter((r) => r.status === "booked").length;
  const noShow = rows.filter((r) => r.status === "no_show").length;

  return (
    <div className="rounded-2xl border bg-[var(--bg-surface)] overflow-hidden">
      <div className="px-5 py-4 border-b bg-[var(--bg-surface-soft)] flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">오늘 클리닉</div>
          <div className="text-xs text-[var(--text-muted)]">{date}</div>
        </div>
        <div className="flex gap-2">
          <button
            className="h-[32px] px-3 rounded-lg border text-xs"
            onClick={onGoBookings}
          >
            예약 추가
          </button>
          <button
            className="h-[32px] px-3 rounded-lg border text-xs"
            onClick={onGoOperations}
          >
            운영 처리
          </button>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* KPI */}
        <div className="grid grid-cols-3 gap-3">
          <KPI label="총 인원" value={rows.length} />
          <KPI label="예약" value={booked} />
          <KPI label="불참" value={noShow} danger />
        </div>

        {loading && (
          <div className="text-xs text-[var(--text-muted)]">불러오는 중...</div>
        )}

        {!loading && sessions.length === 0 && (
          <div className="text-xs text-[var(--text-muted)]">
            오늘 예정된 클리닉이 없습니다.
          </div>
        )}

        {/* 세션 단위 타임라인 (관리자 관점 강화) */}
        {!loading && sessions.length > 0 && (
          <div className="space-y-2">
            {sessions.map((s) => (
              <div
                key={s.sessionId}
                className="rounded-xl border border-[var(--border-divider)] bg-[var(--bg-surface-soft)] px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold">
                      {s.time}
                      {s.end ? ` ~ ${s.end}` : ""} · {s.total}명
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                      {s.location}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[11px] text-[var(--text-muted)]">
                      예약 {s.booked}
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)]">
                      불참 {s.noShow}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function KPI({
  label,
  value,
  danger,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-[var(--bg-surface-soft)] px-4 py-3">
      <div className="text-xs text-[var(--text-muted)]">{label}</div>
      <div
        className={[
          "text-xl font-bold",
          danger ? "text-[var(--color-danger)]" : "",
        ].join(" ")}
      >
        {value}
      </div>
    </div>
  );
}
