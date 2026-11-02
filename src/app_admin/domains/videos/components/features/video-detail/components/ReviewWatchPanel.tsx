import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import { Button } from "@/shared/ui/ds";
import "./ReviewWatchPanel.css";

interface Report {
  enabled: boolean;
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
  const client = useQueryClient();
  const key = ["video-review-watch", videoId] as const;
  const report = useQuery({
    queryKey: key,
    queryFn: async () => (await api.get<Report>(`/media/videos/${videoId}/review-watch/report/`)).data,
  });
  const toggle = useMutation({
    mutationFn: (enabled: boolean) => api.patch(`/media/videos/${videoId}/`, { review_watch_limit_enabled: enabled }),
    onSuccess: () => client.invalidateQueries({ queryKey: key }),
  });
  const data = report.data;
  if (report.isError) return <section className="review-watch"><p role="alert">복습 시청 기록을 불러오지 못했습니다.</p><Button onClick={() => void report.refetch()}>다시 불러오기</Button></section>;
  if (!data) return <p role="status">복습 시청 기록을 불러오는 중…</p>;
  const reached = data.students.filter(row => data.threshold_ms > 0 && row.used_ms >= data.threshold_ms);
  const rows = reachedOnly ? reached : data.students;
  return <section className="review-watch">
    <div className="review-watch__head"><div>
      <h3>복습 시청시간</h3>
      <p>{data.duration ? `학생 한 명당 원본의 1.4배 · ${duration(data.threshold_ms)}` : "영상 길이가 확인되면 한도를 설정할 수 있습니다."}</p>
    </div><Button size="sm" aria-pressed={data.enabled} disabled={!data.duration || toggle.isPending}
      onClick={() => toggle.mutate(!data.enabled)}>{toggle.isPending ? "저장 중…" : data.enabled ? "시간 제한 켜짐" : "시간 제한 꺼짐"}</Button></div>
    {toggle.isError && <p role="alert">설정을 저장하지 못했습니다. 다시 시도해 주세요.</p>}
    <details><summary>학생별 누적 재생시간 · 기준 도달 {reached.length}명</summary>
      <p>집계를 시작한 뒤 실제로 재생한 시간을 합산합니다. 계정 공유 여부는 별도 확인이 필요합니다.</p>
      <label><input type="checkbox" checked={reachedOnly} onChange={e => setReachedOnly(e.target.checked)} /> 원본의 1.4배 이상만 보기</label>
      {rows.length ? <ul>{rows.map(row => <li key={row.student_id}>
        <div><strong>{row.student_name}</strong><small>{new Date(row.started_at).toLocaleDateString("ko-KR")} 집계 시작</small></div>
        <div>{duration(row.used_ms)}{data.duration ? <small>원본의 {(row.used_ms / (data.duration * 1000)).toFixed(2)}배</small> : null}</div>
      </li>)}</ul> : <p>{reachedOnly ? "기준에 도달한 학생이 없습니다." : "아직 집계된 복습 재생시간이 없습니다."}</p>}
    </details>
  </section>;
}
