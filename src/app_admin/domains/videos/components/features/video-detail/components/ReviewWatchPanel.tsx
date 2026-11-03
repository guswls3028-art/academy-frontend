import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import { Button } from "@/shared/ui/ds";
import { expectedUpdatedAtHeaders, isStaleResourceConflict } from "@/shared/api/optimisticConcurrency";
import { originalDurationSeconds, reviewLimitLabel } from "@admin/domains/videos/utils/reviewDuration";
import "./ReviewWatchPanel.css";

interface Report {
  enabled: boolean;
  updated_at?: string;
  source_type?: string;
  duration: number | null;
  threshold_ms: number;
  students: { student_id: number; student_name: string; used_ms: number; started_at: string }[];
}

function duration(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}분 ${seconds % 60}초`;
}

export default function ReviewWatchPanel({ videoId }: { videoId: number }) {
  const [reachedOnly, setReachedOnly] = useState(false);
  const [pendingLimit, setPendingLimit] = useState<boolean | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [lengthDraft, setLengthDraft] = useState<string | null>(null);
  const [expectedAt, setExpectedAt] = useState<string>();
  const [nameFilter, setNameFilter] = useState("");
  const client = useQueryClient();
  const key = ["video-review-watch", videoId] as const;
  const report = useQuery({
    queryKey: key,
    refetchInterval: reportOpen ? 30_000 : false,
    queryFn: async () => (await api.get<Report>(`/media/videos/${videoId}/review-watch/report/`)).data,
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
  const term = nameFilter.trim();
  const rows = (reachedOnly ? reached : data.students).filter(row => row.student_name.includes(term));
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
    <details onToggle={event => setReportOpen(event.currentTarget.open)}><summary>학생별 누적 재생시간 · 기준 도달 {reached.length}명</summary>
      <p>집계를 시작한 뒤 실제로 재생한 시간을 합산합니다. 계정 공유 여부는 별도 확인이 필요합니다.</p>
      <label><input type="checkbox" checked={reachedOnly} onChange={e => setReachedOnly(e.target.checked)} /> 원본의 1.4배 이상만 보기</label>
      <label className="review-watch__search">학생 이름 검색 <input type="search" value={nameFilter} onChange={event => setNameFilter(event.target.value)} /></label>
      {rows.length ? <ul>{rows.map(row => <li key={row.student_id}>
        <div><strong>{row.student_name}</strong><small>{new Date(row.started_at).toLocaleDateString("ko-KR")} 집계 시작</small></div>
        <div>{duration(row.used_ms)}{data.duration ? <small>원본의 {(row.used_ms / (data.duration * 1000)).toFixed(2)}배</small> : null}</div>
      </li>)}</ul> : <p>{term ? "조건에 맞는 학생이 없습니다." : reachedOnly ? "기준에 도달한 학생이 없습니다." : "아직 집계된 복습 재생시간이 없습니다."}</p>}
    </details>
  </section>;
}
