// PATH: src/features/clinic/components/home/ClinicTodaySummary.tsx
// 오늘 클리닉 요약 — 섹션형(카드 아님), 숫자·시각 위계

import { Button, KPI } from "@/shared/ui/ds";
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
    return { sessionId, time, end, location, total: rs.length, booked, noShow };
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
    <section className="clinic-home__section">
      <div className="clinic-home__header flex items-center justify-between gap-4">
        <div>
          <h2 className="clinic-home__title">오늘 클리닉</h2>
          <p className="clinic-home__meta">{date}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" intent="secondary" onClick={onGoBookings}>
            예약 추가
          </Button>
          <Button size="sm" intent="primary" onClick={onGoOperations}>
            운영
          </Button>
        </div>
      </div>
      <div className="clinic-home__body">
        <div className="ds-section__kpi-list flex flex-wrap gap-4 mb-4">
          <KPI label="총 인원" value={rows.length} />
          <KPI label="예약" value={booked} />
          <KPI
            label="불참"
            value={noShow}
            hint={noShow > 0 ? "확인 필요" : undefined}
          />
        </div>
        {noShow > 0 && (
          <p className="text-sm font-semibold text-[var(--color-error)] mb-3">
            불참 {noShow}명
          </p>
        )}
        {loading && (
          <p className="text-xs text-[var(--color-text-muted)]">불러오는 중…</p>
        )}
        {!loading && sessions.length === 0 && (
          <p className="ds-section__empty">오늘 예정된 클리닉이 없습니다.</p>
        )}
        {!loading && sessions.length > 0 && (
          <div className="space-y-2">
            {sessions.map((s) => (
              <div
                key={s.sessionId}
                className="clinic-time-block flex items-start justify-between gap-3"
              >
                <div>
                  <span className="font-semibold">
                    {s.time}
                    {s.end ? ` ~ ${s.end}` : ""}
                  </span>
                  <span className="text-[var(--color-text-muted)] ml-2">
                    · {s.total}명
                  </span>
                  {s.location && (
                    <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                      {s.location}
                    </p>
                  )}
                </div>
                <div className="text-right text-xs">
                  <div className="text-[var(--color-text-muted)]">예약 {s.booked}</div>
                  <div
                    className={
                      s.noShow > 0 ? "clinic-time-block--alert" : "text-[var(--color-text-muted)]"
                    }
                  >
                    불참 {s.noShow}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
