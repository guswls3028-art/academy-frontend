// PATH: src/features/videos/components/features/video-analytics/VideoLogTab.tsx

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import JsonViewerModal from "./JsonViewerModal";

type RangeKey = "24h" | "7d" | "all";

const RANGE_LABELS: Record<RangeKey, string> = {
  "24h": "24시간",
  "7d": "7일",
  all: "전체",
};

type Props = {
  videoId: number;
  onClickRiskStudent: (enrollmentId: number) => void;
};

function SeverityBadge({ severity }: { severity: string }) {
  const tone =
    severity === "danger"
      ? "danger"
      : severity === "warn"
        ? "warning"
        : "neutral";
  const label =
    severity === "danger"
      ? "위험"
      : severity === "warn"
        ? "주의"
        : "정보";
  return (
    <span className="ds-status-badge ds-status-badge--1ch" data-tone={tone}>
      {label}
    </span>
  );
}

export default function VideoLogTab({ videoId, onClickRiskStudent }: Props) {
  const [range, setRange] = useState<RangeKey>("24h");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);

  const listQueryKey = useMemo(
    () => ["video", videoId, "events", range, page],
    [videoId, range, page]
  );
  const riskQueryKey = useMemo(
    () => ["video", videoId, "events-risk", range],
    [videoId, range]
  );

  const { data: listData, isFetching } = useQuery({
    queryKey: listQueryKey,
    queryFn: async () => {
      const res = await api.get("/media/video-playback-events/", {
        params: { video: videoId, range, page, page_size: pageSize },
      });
      return res.data;
    },
    enabled: !!videoId,
    staleTime: 3000,
    retry: 1,
  });

  const { data: riskData } = useQuery({
    queryKey: riskQueryKey,
    queryFn: async () => {
      const res = await api.get("/media/video-playback-events/risk/", {
        params: { video: videoId, range, limit: 5 },
      });
      return res.data;
    },
    enabled: !!videoId,
    staleTime: 3000,
    retry: 1,
  });

  const events = useMemo(() => {
    if (!listData) return [];
    if (Array.isArray(listData)) return listData;
    return listData.results ?? [];
  }, [listData]);

  const totalCount = useMemo(() => {
    if (!listData) return 0;
    if (Array.isArray(listData)) return listData.length;
    return Number(listData.count ?? 0);
  }, [listData]);

  const riskTop = Array.isArray(riskData) ? riskData : riskData ?? [];

  const canPrev = page > 1;
  const canNext = events.length === pageSize;

  return (
    <div className="h-full flex gap-4">
      {/* LEFT — Risk Students Panel */}
      <div
        className="w-[300px] flex flex-col min-h-0 overflow-hidden"
        style={{
          borderRadius: "var(--radius-xl)",
          border: "1px solid var(--color-border-subtle)",
          background: "var(--color-bg-surface)",
        }}
      >
        {/* Panel header */}
        <div
          className="flex items-center justify-between"
          style={{
            padding: "var(--space-3) var(--space-4)",
            borderBottom: "1px solid var(--color-border-subtle)",
            background: "var(--color-bg-surface-soft, var(--bg-surface-soft))",
          }}
        >
          <div
            className="font-semibold"
            style={{
              fontSize: "var(--text-sm, 13px)",
              color: "var(--color-text-primary)",
            }}
          >
            위반 / 이상 징후
          </div>
          <span
            className="ds-status-badge ds-status-badge--1ch"
            data-tone="danger"
          >
            {riskTop.length}
          </span>
        </div>

        {/* Range selector + CSV */}
        <div
          style={{
            padding: "var(--space-3) var(--space-4)",
            borderBottom: "1px solid var(--color-border-subtle)",
          }}
        >
          <div className="flex gap-1.5">
            {(["24h", "7d", "all"] as const).map((k) => (
              <button
                key={k}
                type="button"
                className="permission-tab"
                style={{
                  padding: "var(--space-1) var(--space-3)",
                  fontSize: "var(--text-xs, 11px)",
                  fontWeight: range === k ? 600 : 500,
                  background:
                    range === k
                      ? "var(--color-bg-surface)"
                      : "transparent",
                  boxShadow: range === k ? "var(--elevation-1)" : "none",
                  color:
                    range === k
                      ? "var(--color-text-primary)"
                      : "var(--color-text-secondary)",
                  borderRadius: "var(--radius-sm)",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 140ms ease",
                }}
                onClick={() => {
                  setRange(k);
                  setPage(1);
                }}
              >
                {RANGE_LABELS[k]}
              </button>
            ))}
          </div>

          <button
            className="w-full mt-2"
            type="button"
            style={{
              height: 32,
              fontSize: "var(--text-xs, 11px)",
              fontWeight: 600,
              color: "var(--color-text-secondary)",
              background: "var(--color-bg-surface)",
              border: "1px solid var(--color-border-default)",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              transition: "all 140ms ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                "var(--color-bg-surface-hover, var(--bg-surface-soft))";
              (e.currentTarget as HTMLButtonElement).style.borderColor =
                "var(--color-brand-primary)";
              (e.currentTarget as HTMLButtonElement).style.color =
                "var(--color-brand-primary)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                "var(--color-bg-surface)";
              (e.currentTarget as HTMLButtonElement).style.borderColor =
                "var(--color-border-default)";
              (e.currentTarget as HTMLButtonElement).style.color =
                "var(--color-text-secondary)";
            }}
          >
            CSV Export
          </button>
        </div>

        {/* Hint */}
        <div
          style={{
            padding: "var(--space-2) var(--space-4)",
            fontSize: "10px",
            color: "var(--color-text-muted)",
            borderBottom: "1px solid var(--color-border-subtle)",
          }}
        >
          학생 클릭 시 <b>권한 설정 탭</b>에서 해당 학생만 표시
        </div>

        {/* Risk student list */}
        <div className="flex-1 min-h-0 overflow-auto" style={{ padding: "var(--space-3) var(--space-4)" }}>
          <div className="space-y-2">
            {riskTop.length === 0 ? (
              <div
                className="flex items-center justify-center"
                style={{
                  padding: "var(--space-6)",
                  fontSize: "var(--text-sm, 12px)",
                  color: "var(--color-text-muted)",
                }}
              >
                이상 징후 학생 없음
              </div>
            ) : (
              riskTop.map((r: any) => (
                <button
                  key={r.enrollment_id}
                  className="w-full text-left"
                  onClick={() => onClickRiskStudent(r.enrollment_id)}
                  type="button"
                  style={{
                    display: "block",
                    padding: "var(--space-3)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--color-border-subtle)",
                    background: "var(--color-bg-surface)",
                    cursor: "pointer",
                    transition: "all 160ms ease",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "var(--color-bg-surface-hover, var(--bg-surface-soft))";
                    (e.currentTarget as HTMLButtonElement).style.borderColor =
                      "var(--color-border-default)";
                    (e.currentTarget as HTMLButtonElement).style.boxShadow =
                      "var(--elevation-1)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "var(--color-bg-surface)";
                    (e.currentTarget as HTMLButtonElement).style.borderColor =
                      "var(--color-border-subtle)";
                    (e.currentTarget as HTMLButtonElement).style.boxShadow =
                      "none";
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="font-semibold truncate"
                      style={{
                        fontSize: "var(--text-sm, 13px)",
                        color: "var(--color-text-primary)",
                      }}
                    >
                      {r.student_name}
                    </span>
                    <span
                      className="ds-status-badge ds-status-badge--1ch"
                      data-tone={
                        r.danger > 0
                          ? "danger"
                          : r.warn > 0
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {r.score}
                    </span>
                  </div>
                  <div
                    className="mt-1.5 flex items-center gap-2"
                    style={{ fontSize: "var(--text-xs, 11px)" }}
                  >
                    {r.danger > 0 && (
                      <span style={{ color: "var(--color-danger)" }}>
                        위험 {r.danger}
                      </span>
                    )}
                    {r.warn > 0 && (
                      <span style={{ color: "var(--color-warning)" }}>
                        주의 {r.warn}
                      </span>
                    )}
                  </div>
                  <div
                    className="mt-1 truncate"
                    style={{
                      fontSize: "10px",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    {r.last_occurred_at
                      ? new Date(r.last_occurred_at).toLocaleString()
                      : "-"}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "var(--space-3) var(--space-4)",
            borderTop: "1px solid var(--color-border-subtle)",
            background: "var(--color-bg-surface-soft, var(--bg-surface-soft))",
            fontSize: "var(--text-xs, 11px)",
            color: "var(--color-text-muted)",
            fontWeight: 600,
          }}
        >
          총 이벤트: {totalCount.toLocaleString()}건
        </div>
      </div>

      {/* RIGHT — Event Log Table */}
      <div
        className="flex-1 flex flex-col min-h-0 overflow-hidden"
        style={{
          borderRadius: "var(--radius-xl)",
          border: "1px solid var(--color-border-subtle)",
          background: "var(--color-bg-surface)",
        }}
      >
        {/* Table header bar */}
        <div
          className="flex items-center justify-between"
          style={{
            padding: "var(--space-3) var(--space-4)",
            borderBottom: "1px solid var(--color-border-subtle)",
            background: "var(--color-bg-surface-soft, var(--bg-surface-soft))",
          }}
        >
          <div className="flex items-center gap-2">
            <span
              className="font-semibold"
              style={{
                fontSize: "var(--text-sm, 13px)",
                color: "var(--color-text-primary)",
              }}
            >
              시청 로그
            </span>
            {isFetching && (
              <span
                style={{
                  fontSize: "var(--text-xs, 11px)",
                  color: "var(--color-text-muted)",
                }}
              >
                동기화 중...
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span
              className="ds-status-badge ds-status-badge--1ch"
              data-tone="neutral"
            >
              {RANGE_LABELS[range]}
            </span>
            <span
              style={{
                fontSize: "var(--text-xs, 11px)",
                color: "var(--color-text-muted)",
              }}
            >
              {page} 페이지
            </span>
          </div>
        </div>

        {/* Column headers */}
        <div
          className="grid grid-cols-12 items-center"
          style={{
            padding: "var(--space-2) var(--space-4)",
            fontSize: "var(--text-xs, 11px)",
            fontWeight: 600,
            color: "var(--color-text-tertiary)",
            letterSpacing: "0.01em",
            borderBottom: "1px solid var(--color-border-subtle)",
            background: "var(--color-bg-surface)",
          }}
        >
          <div className="col-span-2">시간</div>
          <div className="col-span-2">학생</div>
          <div className="col-span-3">타입</div>
          <div className="col-span-1 text-center">위반</div>
          <div className="col-span-2">사유</div>
          <div className="col-span-1 text-center">점수</div>
          <div className="col-span-1 text-center">세션</div>
        </div>

        {/* Event rows */}
        <div className="flex-1 min-h-0 overflow-auto">
          {events.length === 0 ? (
            <div
              className="flex items-center justify-center"
              style={{
                padding: "var(--space-8)",
                fontSize: "var(--text-sm, 13px)",
                color: "var(--color-text-muted)",
              }}
            >
              이벤트가 없습니다.
            </div>
          ) : (
            events.map((e: any, idx: number) => (
              <button
                key={e.id}
                className="w-full text-left grid grid-cols-12 items-center"
                onClick={() => setSelectedEvent(e)}
                type="button"
                style={{
                  padding: "var(--space-2) var(--space-4)",
                  fontSize: "var(--text-xs, 11px)",
                  borderBottom: "1px solid var(--color-border-subtle)",
                  background:
                    idx % 2 === 1
                      ? "color-mix(in srgb, var(--color-brand-primary) 2%, var(--color-bg-surface))"
                      : "var(--color-bg-surface)",
                  cursor: "pointer",
                  transition: "background 120ms ease",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "var(--color-bg-surface-hover, var(--bg-surface-soft))";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    idx % 2 === 1
                      ? "color-mix(in srgb, var(--color-brand-primary) 2%, var(--color-bg-surface))"
                      : "var(--color-bg-surface)";
                }}
              >
                <div
                  className="col-span-2 truncate"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  {e.occurred_at
                    ? new Date(e.occurred_at).toLocaleString()
                    : "-"}
                </div>
                <div
                  className="col-span-2 truncate font-medium"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {e.student_name}
                </div>
                <div className="col-span-3 flex items-center gap-2">
                  <SeverityBadge severity={e.severity} />
                  <span
                    className="truncate"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    {e.event_type}
                  </span>
                </div>
                <div className="col-span-1 flex justify-center">
                  {e.violated ? (
                    <span
                      className="ds-status-badge ds-status-badge--1ch"
                      data-tone="danger"
                    >
                      Y
                    </span>
                  ) : (
                    <span
                      style={{
                        color: "var(--color-text-muted)",
                        fontSize: "var(--text-xs, 11px)",
                      }}
                    >
                      -
                    </span>
                  )}
                </div>
                <div
                  className="col-span-2 truncate"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  {e.violation_reason || "-"}
                </div>
                <div
                  className="col-span-1 text-center font-bold"
                  style={{
                    color:
                      (e.score ?? 0) > 0
                        ? "var(--color-danger)"
                        : "var(--color-text-muted)",
                  }}
                >
                  {e.score}
                </div>
                <div
                  className="col-span-1 text-center truncate"
                  style={{
                    color: "var(--color-text-muted)",
                    fontFamily: "monospace",
                    fontSize: "10px",
                  }}
                >
                  {e.session_id ? String(e.session_id).slice(0, 6) : "-"}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Pagination footer */}
        <div
          className="flex items-center justify-between"
          style={{
            padding: "var(--space-2) var(--space-4)",
            borderTop: "1px solid var(--color-border-subtle)",
            background: "var(--color-bg-surface-soft, var(--bg-surface-soft))",
          }}
        >
          <span
            style={{
              fontSize: "var(--text-xs, 11px)",
              color: "var(--color-text-muted)",
            }}
          >
            {events.length > 0
              ? `${(page - 1) * pageSize + 1}~${(page - 1) * pageSize + events.length}건`
              : "0건"}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!canPrev}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              style={{
                height: 28,
                padding: "0 var(--space-3)",
                fontSize: "var(--text-xs, 11px)",
                fontWeight: 600,
                color: "var(--color-text-secondary)",
                background: "var(--color-bg-surface)",
                border: "1px solid var(--color-border-default)",
                borderRadius: "var(--radius-sm)",
                cursor: canPrev ? "pointer" : "not-allowed",
                opacity: canPrev ? 1 : 0.45,
                transition: "all 140ms ease",
              }}
            >
              이전
            </button>
            <button
              type="button"
              disabled={!canNext}
              onClick={() => setPage((p) => p + 1)}
              style={{
                height: 28,
                padding: "0 var(--space-3)",
                fontSize: "var(--text-xs, 11px)",
                fontWeight: 600,
                color: "var(--color-text-secondary)",
                background: "var(--color-bg-surface)",
                border: "1px solid var(--color-border-default)",
                borderRadius: "var(--radius-sm)",
                cursor: canNext ? "pointer" : "not-allowed",
                opacity: canNext ? 1 : 0.45,
                transition: "all 140ms ease",
              }}
            >
              다음
            </button>
          </div>
        </div>
      </div>

      <JsonViewerModal
        open={!!selectedEvent}
        title={`Event #${selectedEvent?.id} · ${selectedEvent?.student_name} · ${selectedEvent?.event_type}`}
        payload={selectedEvent?.event_payload}
        snapshot={selectedEvent?.policy_snapshot}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  );
}
