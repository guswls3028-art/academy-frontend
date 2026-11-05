import { useState } from "react";
import { Link, useLocation } from "react-router";
import { fetchWatchReport, watchLogsPath, watchReportKey, type WatchReport as Report } from "@/shared/media/video/watchLogs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import { Button } from "@/shared/ui/ds";
import { expectedUpdatedAtHeaders, isStaleResourceConflict } from "@/shared/api/optimisticConcurrency";
import { originalDurationSeconds, reviewLimitLabel } from "@/shared/media/video/reviewDuration";
import "./ReviewWatchPanel.css";


function duration(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}분 ${seconds % 60}초`;
}

export default function ReviewWatchPanel({ videoId }: { videoId: number }) {
  const [pendingLimit, setPendingLimit] = useState<boolean | null>(null);
  const [lengthDraft, setLengthDraft] = useState<string | null>(null);
  const [expectedAt, setExpectedAt] = useState<string>();
  const client = useQueryClient();
  const location = useLocation();
  const key = watchReportKey(videoId);
  const report = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => fetchWatchReport(videoId, signal),
  });
  const toggle = useMutation({
    mutationFn: (change: { review_watch_limit_enabled?: boolean; duration?: number }) => api.patch(`/media/videos/${videoId}/`, change,
      { headers: expectedAt ? expectedUpdatedAtHeaders(expectedAt) : undefined }),
    onSuccess: async (_, change) => {
      if (change.review_watch_limit_enabled !== undefined) {
        client.setQueryData<Report>(key, current => current && { ...current, enabled: change.review_watch_limit_enabled ?? current.enabled });
      }
      setLengthDraft(null);
      setPendingLimit(null);
      await client.invalidateQueries({ queryKey: key });
    },
    onError: async () => {
      const fresh = await report.refetch();
      if (fresh.data) setExpectedAt(fresh.data.updated_at);
    },
  });
  const data = report.data;
  if (report.isError) return <section className="review-watch"><p role="alert">복습 시청 기록을 불러오지 못했습니다.</p><Button onClick={() => void report.refetch()}>다시 불러오기</Button></section>;
  if (!data) return <p role="status">복습 시청 기록을 불러오는 중…</p>;
  const reached = data.students.filter(row => data.threshold_ms > 0 && row.used_ms >= data.threshold_ms);
  const newLength = originalDurationSeconds(lengthDraft ?? "");
  return <section className="review-watch">
    <div className="review-watch__head"><div>
      <h3>복습 시청시간</h3>
      <p>{data.duration ? `학생 한 명당 원본의 1.4배 · ${duration(data.threshold_ms)}` : "영상 길이가 확인되면 한도를 설정할 수 있습니다."}</p>
    </div><Button size="sm" aria-pressed={data.enabled} disabled={(!data.enabled && !data.duration) || toggle.isPending}
      onClick={() => { toggle.reset(); setExpectedAt(data.updated_at); setLengthDraft(null); setPendingLimit(!data.enabled); }}>{data.enabled ? "시간 제한 켜짐" : "시간 제한 꺼짐"}</Button></div>
    {pendingLimit !== null && pendingLimit !== data.enabled && <div className="review-watch__confirm" role="group" aria-label="복습 시청시간 변경 확인">
      <p>{pendingLimit
        ? `제한을 켜면 학생당 ${duration(data.threshold_ms)}까지 복습할 수 있습니다. 이미 기준에 도달한 학생 ${reached.length}명은 다시 열 수 없습니다.`
        : "제한을 끄면 한도에 도달한 학생도 다시 볼 수 있습니다. 누적 재생시간은 계속 기록됩니다."}</p>
      <Button size="sm" disabled={toggle.isPending} onClick={() => toggle.mutate({ review_watch_limit_enabled: pendingLimit })}>{toggle.isPending ? "저장 중…" : pendingLimit ? "제한 켜기" : "제한 끄기"}</Button>
      <Button size="sm" disabled={toggle.isPending} onClick={() => { setPendingLimit(null); toggle.reset(); }}>취소</Button>
    </div>}
    {data.source_type === "youtube" && (lengthDraft === null ? <Button size="sm" disabled={toggle.isPending} onClick={() => {
      toggle.reset(); setExpectedAt(data.updated_at); setPendingLimit(null);
      setLengthDraft(data.duration ? `${Math.floor(data.duration / 60)}:${String(data.duration % 60).padStart(2, "0")}` : "");
    }}>YouTube 원본 길이 수정</Button> : <div className="review-watch__confirm" role="group" aria-label="YouTube 원본 길이 수정">
      <label>원본 길이 (분 또는 분:초) <input value={lengthDraft} onChange={event => setLengthDraft(event.target.value)} /></label>
      <p>{newLength ? `변경 후 복습 기준 ${reviewLimitLabel(newLength)} · 현재 기록으로 기준 도달 ${data.students.filter(row => row.used_ms >= newLength * 1400).length}명` : "예: 60 또는 60:30"}</p>
      <Button size="sm" disabled={!newLength || newLength === data.duration || toggle.isPending} onClick={() => { if (newLength) toggle.mutate({ duration: newLength }); }}>원본 길이 저장</Button>
      <Button size="sm" disabled={toggle.isPending} onClick={() => { setLengthDraft(null); toggle.reset(); }}>취소</Button>
    </div>)}
    {toggle.isError && (lengthDraft !== null || pendingLimit !== data.enabled) && <p role="alert">{isStaleResourceConflict(toggle.error)
      ? "다른 선생님이 먼저 변경했습니다. 최신 설정을 확인한 뒤 다시 저장해 주세요."
      : "저장 결과를 확인하지 못했습니다. 현재 설정을 확인한 뒤 다시 시도해 주세요."}</p>}
    <p><Link className="text-[var(--color-primary)] underline" to={watchLogsPath(videoId, location.pathname + location.search)}>학생별 누적 시간은 시청 로그에서 확인 →</Link></p>
  </section>;
}
