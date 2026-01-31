// PATH: src/features/videos/components/features/video-analytics/VideoLogTab.tsx

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import JsonViewerModal from "./JsonViewerModal";

type RangeKey = "24h" | "7d" | "all";

const SEV_COLORS: Record<string, string> = {
  danger: "bg-red-600",
  warn: "bg-yellow-500",
  info: "bg-[var(--bg-surface-muted)] text-[var(--text-secondary)]",
};

type Props = {
  videoId: number;
  onClickRiskStudent: (enrollmentId: number) => void;
};

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
      {/* LEFT */}
      <div className="w-[300px] rounded-xl border border-[var(--border-divider)] bg-[var(--bg-surface)] overflow-hidden flex flex-col">
        <div className="px-3 py-2 border-b border-[var(--border-divider)] bg-[var(--bg-surface-soft)] text-sm font-semibold">
          위반 / 이상 징후 학생
        </div>

        <div className="p-3 space-y-3">
          <div className="flex gap-2">
            {(["24h", "7d", "all"] as const).map((k) => (
              <button
                key={k}
                className={`text-xs px-2 py-1 rounded border border-[var(--border-divider)] ${
                  range === k
                    ? "bg-[var(--bg-surface)] font-semibold"
                    : "bg-[var(--bg-surface-soft)]"
                }`}
                onClick={() => {
                  setRange(k);
                  setPage(1);
                }}
              >
                {k === "24h" ? "24h" : k === "7d" ? "7d" : "전체"}
              </button>
            ))}
          </div>

          <button
            className="w-full text-xs px-3 py-2 rounded border border-[var(--border-divider)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-soft)]"
            type="button"
          >
            CSV Export
          </button>

          <div className="text-[11px] text-[var(--text-muted)]">
            * 학생 클릭 → <b>권한 설정 탭</b>에서 해당 학생만 표시
          </div>

          <div className="space-y-2">
            {riskTop.length === 0 ? (
              <div className="text-xs text-[var(--text-muted)] p-2">
                데이터 없음
              </div>
            ) : (
              riskTop.map((r: any) => (
                <button
                  key={r.enrollment_id}
                  className="w-full text-left rounded-lg border border-[var(--border-divider)] px-3 py-2 hover:bg-[var(--bg-surface-soft)]"
                  onClick={() => onClickRiskStudent(r.enrollment_id)}
                  type="button"
                >
                  <div className="text-sm font-semibold">{r.student_name}</div>
                  <div className="text-xs text-[var(--text-secondary)] mt-1">
                    점수 <b>{r.score}</b> · danger {r.danger} · warn {r.warn}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)] mt-1 truncate">
                    last:{" "}
                    {r.last_occurred_at
                      ? new Date(r.last_occurred_at).toLocaleString()
                      : "-"}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="mt-auto border-t border-[var(--border-divider)] p-3 text-xs text-[var(--text-muted)]">
          총 이벤트: {totalCount.toLocaleString()}건
        </div>
      </div>

      {/* RIGHT */}
      <div className="flex-1 rounded-xl border border-[var(--border-divider)] bg-[var(--bg-surface)] overflow-hidden flex flex-col">
        <div className="px-3 py-2 border-b border-[var(--border-divider)] bg-[var(--bg-surface-soft)] flex items-center justify-between">
          <div className="text-sm font-semibold">
            시청 로그
            {isFetching && (
              <span className="ml-2 text-xs text-[var(--text-muted)]">
                동기화 중...
              </span>
            )}
          </div>
          <div className="text-xs text-[var(--text-secondary)]">
            range: {range} · page: {page}
          </div>
        </div>

        <div className="grid grid-cols-12 text-xs font-semibold border-b border-[var(--border-divider)] px-3 py-2 bg-[var(--bg-surface)] text-[var(--text-secondary)]">
          <div className="col-span-2">시간</div>
          <div className="col-span-2">학생</div>
          <div className="col-span-3">타입</div>
          <div className="col-span-1 text-center">위반</div>
          <div className="col-span-2">사유</div>
          <div className="col-span-1 text-center">점수</div>
          <div className="col-span-1 text-center">세션</div>
        </div>

        <div className="flex-1 overflow-auto">
          {events.length === 0 ? (
            <div className="p-4 text-sm text-[var(--text-muted)]">
              이벤트가 없습니다.
            </div>
          ) : (
            events.map((e: any) => (
              <button
                key={e.id}
                className="w-full text-left grid grid-cols-12 px-3 py-2 border-b border-[var(--border-divider)] hover:bg-[var(--bg-surface-soft)] text-xs"
                onClick={() => setSelectedEvent(e)}
                type="button"
              >
                <div className="col-span-2 text-[var(--text-secondary)]">
                  {e.occurred_at ? new Date(e.occurred_at).toLocaleString() : "-"}
                </div>
                <div className="col-span-2 font-medium truncate">
                  {e.student_name}
                </div>
                <div className="col-span-3 flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-white text-[10px] ${
                      SEV_COLORS[e.severity] || "bg-gray-500"
                    }`}
                  >
                    {e.severity}
                  </span>
                  <span className="truncate">{e.event_type}</span>
                </div>
                <div className="col-span-1 text-center">
                  {e.violated ? "Y" : "-"}
                </div>
                <div className="col-span-2 text-[var(--text-secondary)] truncate">
                  {e.violation_reason || "-"}
                </div>
                <div className="col-span-1 text-center font-bold">{e.score}</div>
                <div className="col-span-1 text-center text-[var(--text-muted)] truncate">
                  {e.session_id ? String(e.session_id).slice(0, 6) : "-"}
                </div>
              </button>
            ))
          )}
        </div>

        <div className="px-3 py-2 border-t border-[var(--border-divider)] bg-[var(--bg-surface-soft)] flex justify-end gap-2">
          <button
            className="text-xs px-3 py-1 rounded border border-[var(--border-divider)] bg-[var(--bg-surface)] disabled:opacity-50"
            disabled={!canPrev}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            type="button"
          >
            이전
          </button>
          <button
            className="text-xs px-3 py-1 rounded border border-[var(--border-divider)] bg-[var(--bg-surface)] disabled:opacity-50"
            disabled={!canNext}
            onClick={() => setPage((p) => p + 1)}
            type="button"
          >
            다음
          </button>
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
