// PATH: src/app_admin/domains/videos/components/features/video-analytics/VideoLogTab.tsx

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import { Badge, Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import JsonViewerModal from "./JsonViewerModal";
import "./VideoAnalyticsTabs.css";

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

type Severity = "danger" | "warn" | "info" | string;

type PlaybackEvent = {
  id: number;
  video?: number;
  enrollment_id: number;
  student_name: string;
  session_id?: string | null;
  user_id?: number | string | null;
  event_type: string;
  violated: boolean;
  violation_reason?: string | null;
  event_payload?: unknown;
  policy_snapshot?: unknown;
  occurred_at?: string | null;
  received_at?: string | null;
  severity: Severity;
  score: number;
};

type RiskStudent = {
  enrollment_id: number;
  student_name: string;
  score: number;
  danger: number;
  warn: number;
  info: number;
  last_occurred_at?: string | null;
};

type ListEnvelope<T> = {
  results?: T[];
  count?: number;
};

type EventListResponse = PlaybackEvent[] | ListEnvelope<PlaybackEvent>;
type RiskResponse = RiskStudent[] | ListEnvelope<RiskStudent>;

function rowsFromResponse<T>(data: T[] | ListEnvelope<T> | undefined): T[] {
  if (!data) return [];
  return Array.isArray(data) ? data : data.results ?? [];
}

function countFromResponse<T>(
  data: T[] | ListEnvelope<T> | undefined,
  fallback: number
) {
  if (!data) return 0;
  if (Array.isArray(data)) return data.length;
  return Number(data.count ?? fallback);
}

function SeverityBadge({ severity }: { severity: Severity }) {
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
    <Badge variant="solid" tone={tone} oneChar>
      {label}
    </Badge>
  );
}

function rowClassName(isAlt: boolean) {
  return [
    "video-analytics-row",
    "grid w-full grid-cols-12 items-center text-left",
    isAlt && "video-analytics-row--alt",
  ]
    .filter(Boolean)
    .join(" ");
}

export default function VideoLogTab({ videoId, onClickRiskStudent }: Props) {
  const [range, setRange] = useState<RangeKey>("24h");
  const [page, setPage] = useState(1);
  const [selectedEvent, setSelectedEvent] = useState<PlaybackEvent | null>(
    null
  );
  const [isExporting, setIsExporting] = useState(false);
  const pageSize = 50;

  const listQueryKey = useMemo(
    () => ["video", videoId, "events", range, page],
    [videoId, range, page]
  );
  const riskQueryKey = useMemo(
    () => ["video", videoId, "events-risk", range],
    [videoId, range]
  );

  const { data: listData, isFetching } = useQuery<EventListResponse>({
    queryKey: listQueryKey,
    queryFn: async () => {
      const res = await api.get("/media/video-playback-events/", {
        params: { video: videoId, range, page, page_size: pageSize },
      });
      return res.data as EventListResponse;
    },
    enabled: !!videoId,
    staleTime: 3000,
    retry: 1,
  });

  const { data: riskData } = useQuery<RiskResponse>({
    queryKey: riskQueryKey,
    queryFn: async () => {
      const res = await api.get("/media/video-playback-events/risk/", {
        params: { video: videoId, range, limit: 5 },
      });
      return res.data as RiskResponse;
    },
    enabled: !!videoId,
    staleTime: 3000,
    retry: 1,
  });

  const events = useMemo(() => rowsFromResponse(listData), [listData]);
  const riskTop = useMemo(() => rowsFromResponse(riskData), [riskData]);
  const totalCount = useMemo(
    () => countFromResponse(listData, events.length),
    [events.length, listData]
  );

  const canPrev = page > 1;
  const canNext =
    totalCount > 0 ? page * pageSize < totalCount : events.length === pageSize;

  const handleExportCsv = async () => {
    if (isExporting) return;

    setIsExporting(true);
    try {
      const res = await api.get<Blob>("/media/video-playback-events/export/", {
        params: { video: videoId, range },
        responseType: "blob",
      });

      const url = URL.createObjectURL(res.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `video_${videoId}_events_${range}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      feedback.error("CSV 내보내기에 실패했습니다.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="h-full flex gap-4">
      <div className="video-analytics-card video-analytics-card--flush w-[300px] flex flex-col min-h-0 overflow-hidden">
        <div className="video-analytics-panel-header">
          <div className="video-analytics-section-title">
            위반 / 이상 징후
          </div>
          <Badge variant="solid" tone="danger" oneChar>
            {riskTop.length}
          </Badge>
        </div>

        <div className="video-analytics-panel-section">
          <div className="flex gap-1.5">
            {(["24h", "7d", "all"] as const).map((k) => (
              <button
                key={k}
                type="button"
                className="video-analytics-range-tab"
                data-active={range === k}
                onClick={() => {
                  setRange(k);
                  setPage(1);
                }}
              >
                {RANGE_LABELS[k]}
              </button>
            ))}
          </div>

          <Button
            intent="secondary"
            size="sm"
            className="w-full mt-2"
            disabled={isExporting}
            onClick={handleExportCsv}
          >
            {isExporting ? "Exporting..." : "CSV Export"}
          </Button>
        </div>

        <div className="video-analytics-hint-block">
          학생 클릭 시 <b>권한 설정 탭</b>에서 해당 학생만 표시
        </div>

        <div className="video-analytics-scroll-list">
          <div className="space-y-2">
            {riskTop.length === 0 ? (
              <div className="video-analytics-empty">
                이상 징후 학생 없음
              </div>
            ) : (
              riskTop.map((r) => (
                <button
                  key={r.enrollment_id}
                  className="video-analytics-risk-card"
                  onClick={() => onClickRiskStudent(r.enrollment_id)}
                  type="button"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold truncate video-analytics-primary-text">
                      <StudentNameWithLectureChip
                        name={r.student_name}
                        enrollmentId={r.enrollment_id}
                      />
                    </span>
                    <Badge
                      variant="solid"
                      tone={
                        r.danger > 0
                          ? "danger"
                          : r.warn > 0
                            ? "warning"
                            : "neutral"
                      }
                      oneChar
                    >
                      {r.score}
                    </Badge>
                  </div>
                  <div className="video-analytics-risk-stats">
                    {r.danger > 0 && (
                      <span
                        className="video-analytics-risk-stat"
                        data-tone="danger"
                      >
                        위험 {r.danger}
                      </span>
                    )}
                    {r.warn > 0 && (
                      <span
                        className="video-analytics-risk-stat"
                        data-tone="warning"
                      >
                        주의 {r.warn}
                      </span>
                    )}
                  </div>
                  <div className="video-analytics-muted video-analytics-risk-time">
                    {r.last_occurred_at
                      ? new Date(r.last_occurred_at).toLocaleString()
                      : "-"}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="video-analytics-footer">
          총 이벤트: {totalCount.toLocaleString()}건
        </div>
      </div>

      <div className="video-analytics-card video-analytics-card--flush flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="video-analytics-panel-header">
          <div className="flex items-center gap-2">
            <span className="video-analytics-section-title">
              시청 로그
            </span>
            {isFetching && (
              <span className="video-analytics-muted video-analytics-sync">
                동기화 중...
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="solid" tone="neutral" oneChar>
              {RANGE_LABELS[range]}
            </Badge>
            <span className="video-analytics-muted video-analytics-page-label">
              {page} 페이지
            </span>
          </div>
        </div>

        <div className="video-analytics-table-header grid grid-cols-12 items-center">
          <div className="col-span-2">시간</div>
          <div className="col-span-2">학생</div>
          <div className="col-span-3">타입</div>
          <div className="col-span-1 text-center">위반</div>
          <div className="col-span-2">사유</div>
          <div className="col-span-1 text-center">점수</div>
          <div className="col-span-1 text-center">세션</div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto">
          {events.length === 0 ? (
            <div className="video-analytics-empty">
              이벤트가 없습니다.
            </div>
          ) : (
            events.map((event, idx) => (
              <button
                key={event.id}
                className={rowClassName(idx % 2 === 1)}
                onClick={() => setSelectedEvent(event)}
                type="button"
              >
                <div className="col-span-2 truncate video-analytics-secondary-text">
                  {event.occurred_at
                    ? new Date(event.occurred_at).toLocaleString()
                    : "-"}
                </div>
                <div className="col-span-2 truncate font-medium video-analytics-primary-text">
                  <StudentNameWithLectureChip
                    name={event.student_name ?? "-"}
                    enrollmentId={event.enrollment_id}
                  />
                </div>
                <div className="col-span-3 flex items-center gap-2">
                  <SeverityBadge severity={event.severity} />
                  <span className="truncate video-analytics-secondary-text">
                    {event.event_type}
                  </span>
                </div>
                <div className="col-span-1 flex justify-center">
                  {event.violated ? (
                    <Badge variant="solid" tone="danger" oneChar>
                      Y
                    </Badge>
                  ) : (
                    <span className="video-analytics-muted video-analytics-dash">
                      -
                    </span>
                  )}
                </div>
                <div className="col-span-2 truncate video-analytics-secondary-text">
                  {event.violation_reason || "-"}
                </div>
                <div
                  className={[
                    "col-span-1 text-center font-bold video-analytics-event-score",
                    event.score > 0 && "video-analytics-event-score--danger",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {event.score}
                </div>
                <div className="col-span-1 text-center truncate video-analytics-session-id">
                  {event.session_id ? String(event.session_id).slice(0, 6) : "-"}
                </div>
              </button>
            ))
          )}
        </div>

        <div className="video-analytics-pagination">
          <span className="video-analytics-muted video-analytics-page-label">
            {events.length > 0
              ? `${(page - 1) * pageSize + 1}~${(page - 1) * pageSize + events.length}건`
              : "0건"}
          </span>
          <div className="flex items-center gap-2">
            <Button
              intent="ghost"
              size="sm"
              disabled={!canPrev}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              이전
            </Button>
            <Button
              intent="ghost"
              size="sm"
              disabled={!canNext}
              onClick={() => setPage((p) => p + 1)}
            >
              다음
            </Button>
          </div>
        </div>
      </div>

      <JsonViewerModal
        open={!!selectedEvent}
        title={`Event #${selectedEvent?.id ?? "-"} · ${
          selectedEvent?.student_name ?? "-"
        } · ${selectedEvent?.event_type ?? "-"}`}
        payload={selectedEvent?.event_payload ?? null}
        snapshot={selectedEvent?.policy_snapshot ?? null}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  );
}
