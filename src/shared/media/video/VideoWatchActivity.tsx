import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import { Badge, Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";

type Range = "24h" | "7d" | "all";
type PlaybackEvent = {
  id: number; student_name: string; event_type: string; violated: boolean;
  violation_reason?: string; occurred_at?: string; received_at?: string;
  event_payload?: unknown; policy_snapshot?: unknown;
};
const LABELS: Record<string, string> = {
  VISIBILITY_HIDDEN: "다른 탭으로 이동", VISIBILITY_VISIBLE: "영상 탭으로 복귀",
  FOCUS_LOST: "영상 창에서 벗어남", FOCUS_GAINED: "영상 창으로 복귀",
  SEEK_ATTEMPT: "재생 위치 이동 시도", SPEED_CHANGE_ATTEMPT: "배속 변경 시도",
  FULLSCREEN_ENTER: "전체화면 시작", FULLSCREEN_EXIT: "전체화면 종료", PLAYER_ERROR: "재생 오류",
};

export default function VideoLogTab({ videoId, studentId }: { videoId: number; studentId?: number }) {
  const [range, setRange] = useState<Range>("7d");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const pageSize = 25;
  const params = { video: videoId, ...(studentId ? { student: studentId } : {}), range };
  const query = useQuery({
    queryKey: ["video", videoId, "watch-activity", studentId ?? "all", range, page],
    queryFn: async ({ signal }) => (await api.get<{ results: PlaybackEvent[]; count: number }>("/media/video-playback-events/", {
      params: { ...params, page, page_size: pageSize }, signal,
    })).data,
    retry: 1, staleTime: 5_000,
  });
  const exportCsv = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const { data } = await api.get<Blob>("/media/video-playback-events/export/", { params, responseType: "blob" });
      const url = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = url; link.download = `video-watch-${videoId}-${studentId ?? "all"}-${range}.csv`;
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { feedback.error("활동 기록을 내려받지 못했습니다. 다시 시도해 주세요."); }
    finally { setExporting(false); }
  };
  const rows = query.data?.results ?? [];
  return <section className="watch-logs__events" aria-label="시청 활동 기록">
    <div className="watch-logs__event-header"><div><h2>활동 기록</h2><p>탐색·배속 변경 등의 기록입니다. 아래 기간은 누적 재생시간에 영향을 주지 않습니다.</p></div>
      <Button intent="ghost" size="sm" onClick={() => void exportCsv()} disabled={exporting}>{exporting ? "내려받는 중…" : "기록 내려받기"}</Button></div>
    <div className="watch-logs__range" role="group" aria-label="활동 기록 기간">
      {([['24h', '24시간'], ['7d', '7일'], ['all', '전체 기간']] as const).map(([key, label]) => <Button key={key} intent={range === key ? "primary" : "secondary"} size="sm" aria-pressed={range === key} onClick={() => { setRange(key); setPage(1); }}>{label}</Button>)}
    </div>
    {query.isError ? <div className="watch-logs__state" role="alert"><p>활동 기록을 불러오지 못했습니다.</p><Button onClick={() => void query.refetch()}>활동 기록 다시 불러오기</Button>{page > 1 && <Button intent="ghost" onClick={() => setPage(1)}>처음 기록으로</Button>}</div>
      : query.isPending ? <p role="status">활동 기록을 불러오는 중…</p>
      : rows.length ? <div className="watch-logs__event-list">{rows.map(event => <details key={event.id} className="watch-logs__event">
        <summary><span><strong>{LABELS[event.event_type] ?? "시청 활동"}</strong>{!studentId && <span>{event.student_name}</span>}</span>
          <time dateTime={event.occurred_at}>{event.occurred_at ? new Date(event.occurred_at).toLocaleString("ko-KR") : "시간 미확인"}</time>
          {event.violated && <Badge tone="warning">정책 위반 기록</Badge>}<span className="watch-logs__detail-label">기록 상세 <span className="watch-logs__event-chevron" aria-hidden="true">›</span></span></summary>
        <div className="watch-logs__event-body"><p>{event.violated ? "당시 영상 시청 정책에 어긋난 조작이 기록되었습니다. 오류나 사용 상황을 함께 확인해 주세요." : "일반 활동 기록입니다. 이 기록만으로 부정 이용을 의미하지 않습니다."}</p>
          <details><summary>원본 기록 보기</summary><pre>{JSON.stringify({ 활동: event.event_type, 사유: event.violation_reason || null, 수신시각: event.received_at, 상세: event.event_payload, 당시정책: event.policy_snapshot }, null, 2)}</pre></details>
        </div>
      </details>)}</div> : <div className="watch-logs__state"><h3>선택한 기간의 활동 기록이 없습니다</h3><p>활동 기록은 수강 영상에서 별도로 수집됩니다. 영상만 부여받은 학생의 누적 재생시간은 위 요약에서 확인할 수 있습니다.</p></div>}
    {!query.isError && !query.isPending && <nav className="watch-logs__pagination" aria-label="활동 기록 페이지"><span>{query.data?.count.toLocaleString() ?? 0}건</span><Button intent="ghost" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>이전 기록</Button><span>{page} 페이지</span><Button intent="ghost" disabled={page * pageSize >= (query.data?.count ?? 0)} onClick={() => setPage(p => p + 1)}>다음 기록</Button></nav>}
  </section>;
}
