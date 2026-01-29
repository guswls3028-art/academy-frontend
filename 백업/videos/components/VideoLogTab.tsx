import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import JsonViewerModal from "./JsonViewerModal";

type RangeKey = "24h" | "7d" | "all";

const SEV_COLORS: Record<string, string> = {
  danger: "bg-red-600",
  warn: "bg-yellow-500",
  info: "bg-gray-500",
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

  const riskTop = Array.isArray(riskData) ? riskData : (riskData ?? []);

  const exportCsv = async () => {
    const res = await api.get("/media/video-playback-events/export/", {
      params: { video: videoId, range },
      responseType: "blob",
    });

    const blob = new Blob([res.data], { type: "text/csv;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `video_${videoId}_events_${range}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const canPrev = page > 1;
  const canNext = events.length === pageSize;

  return (
    <div className="h-full flex gap-4">
      {/* LEFT: Risk */}
      <div className="w-[300px] border rounded-xl bg-white overflow-hidden flex flex-col">
        <div className="px-3 py-2 border-b bg-gray-50 text-sm font-semibold">
          위반/이상 징후 학생
        </div>

        <div className="p-3 space-y-3">
          <div className="flex gap-2">
            {(["24h", "7d", "all"] as const).map((k) => (
              <button
                key={k}
                className={`text-xs px-2 py-1 rounded border ${
                  range === k ? "bg-white font-semibold" : "bg-gray-100"
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
            onClick={exportCsv}
            className="w-full text-xs px-3 py-2 border rounded bg-white hover:bg-gray-50"
          >
            CSV Export
          </button>

          <div className="text-[11px] text-gray-500">
            * 학생 클릭 → <b>권한 설정 탭</b>에서 해당 학생만 표시
          </div>

          <div className="space-y-2">
            {riskTop.length === 0 ? (
              <div className="text-xs text-gray-500 p-2">데이터 없음</div>
            ) : (
              riskTop.map((r: any) => (
                <button
                  key={r.enrollment_id}
                  className="w-full text-left border rounded-lg px-3 py-2 hover:bg-gray-50"
                  onClick={() => onClickRiskStudent(r.enrollment_id)}
                >
                  <div className="text-sm font-semibold">{r.student_name}</div>
                  <div className="text-xs text-gray-600 mt-1">
                    점수 <b>{r.score}</b> · danger {r.danger} · warn {r.warn}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-1 truncate">
                    last: {r.last_occurred_at ? new Date(r.last_occurred_at).toLocaleString() : "-"}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="mt-auto border-t p-3 text-xs text-gray-500">
          총 이벤트: {totalCount.toLocaleString()}건
        </div>
      </div>

      {/* RIGHT: Event table */}
      <div className="flex-1 border rounded-xl bg-white overflow-hidden flex flex-col">
        <div className="px-3 py-2 border-b bg-gray-50 flex items-center justify-between">
          <div className="text-sm font-semibold">
            시청 로그 {isFetching ? <span className="text-xs text-gray-500 ml-2">동기화 중...</span> : null}
          </div>
          <div className="text-xs text-gray-600">
            range: {range} · page: {page}
          </div>
        </div>

        <div className="grid grid-cols-12 text-xs font-semibold border-b px-3 py-2 bg-white">
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
            <div className="p-4 text-sm text-gray-500">이벤트가 없습니다.</div>
          ) : (
            events.map((e: any) => (
              <button
                key={e.id}
                className="w-full text-left grid grid-cols-12 px-3 py-2 border-b hover:bg-gray-50 text-xs"
                onClick={() => setSelectedEvent(e)}
              >
                <div className="col-span-2 text-gray-600">
                  {e.occurred_at ? new Date(e.occurred_at).toLocaleString() : "-"}
                </div>
                <div className="col-span-2 font-medium truncate">{e.student_name}</div>
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
                <div className="col-span-1 text-center">{e.violated ? "Y" : "-"}</div>
                <div className="col-span-2 text-gray-600 truncate">{e.violation_reason || "-"}</div>
                <div className="col-span-1 text-center font-bold">{e.score}</div>
                <div className="col-span-1 text-center text-gray-500 truncate">
                  {e.session_id ? String(e.session_id).slice(0, 6) : "-"}
                </div>
              </button>
            ))
          )}
        </div>

        <div className="px-3 py-2 border-t bg-gray-50 flex justify-end gap-2">
          <button
            className="text-xs px-3 py-1 border rounded bg-white disabled:opacity-50"
            disabled={!canPrev}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            이전
          </button>
          <button
            className="text-xs px-3 py-1 border rounded bg-white disabled:opacity-50"
            disabled={!canNext}
            onClick={() => setPage((p) => p + 1)}
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
