// PATH: src/features/clinic/components/home/ClinicTodaySummary.tsx
import { KPI, Button } from "@/shared/ui/ds";
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
    <div className="ds-panel" data-panel-variant="primary">
      <div className="clinic-card__header flex items-center justify-between">
        <div>
          <div
            style={{
              fontSize: "var(--text-md)",
              fontWeight: "var(--font-title)",
              color: "var(--color-text-primary)",
            }}
          >
            오늘 클리닉
          </div>
          <div
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--color-text-muted)",
              marginTop: "var(--space-1)",
            }}
          >
            {date}
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" intent="secondary" onClick={onGoBookings}>
            예약 추가
          </Button>
          <Button size="sm" intent="primary" onClick={onGoOperations}>
            운영 처리
          </Button>
        </div>
      </div>

      <div
        className="clinic-card__body"
        style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
      >
        <div className="grid grid-cols-3 gap-3">
          <KPI label="총 인원" value={rows.length} />
          <KPI label="예약" value={booked} />
          <KPI
            label="불참"
            value={noShow}
            hint={noShow > 0 ? "확인 필요" : undefined}
          />
        </div>
        {noShow > 0 && (
          <div
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-error)",
              fontWeight: "var(--font-meta)",
            }}
          >
            불참 {noShow}명
          </div>
        )}

        {loading && (
          <div
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--color-text-muted)",
            }}
          >
            불러오는 중...
          </div>
        )}

        {!loading && sessions.length === 0 && (
          <div
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--color-text-muted)",
            }}
          >
            오늘 예정된 클리닉이 없습니다.
          </div>
        )}

        {!loading && sessions.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {sessions.map((s) => (
              <div
                key={s.sessionId}
                className="clinic-kpi-block"
                style={{
                  padding: "var(--space-3) var(--space-4)",
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: "var(--space-3)",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "var(--text-xs)",
                      fontWeight: "var(--font-title)",
                      color: "var(--color-text-primary)",
                    }}
                  >
                    {s.time}
                    {s.end ? ` ~ ${s.end}` : ""} · {s.total}명
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "var(--color-text-muted)",
                      marginTop: "2px",
                    }}
                  >
                    {s.location}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "var(--color-text-muted)",
                      fontWeight: "var(--font-meta)",
                    }}
                  >
                    예약 {s.booked}
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: s.noShow > 0 ? "var(--color-error)" : "var(--color-text-muted)",
                      fontWeight: "var(--font-meta)",
                    }}
                  >
                    불참 {s.noShow}
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

