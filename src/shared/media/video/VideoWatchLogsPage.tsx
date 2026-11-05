import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Button } from "@/shared/ui/ds";
import { fetchVideoDetail } from "@/shared/api/contracts/videos";
import { fetchWatchReport, watchDuration, watchLogsReturnPath, watchReportKey, watchLogQueryKeys } from "./watchLogs";
import VideoLogTab from "./VideoWatchActivity";
import "./VideoWatchLogsPage.css";

const PAGE_SIZE = 30;

export default function VideoWatchLogsPage() {
  const teacher = useLocation().pathname.startsWith("/workspace/mobile/");
  const params = useParams();
  const videoId = Number(params.videoId);
  const studentId = params.studentId ? Number(params.studentId) : null;
  const [searchParams, setSearchParams] = useSearchParams();
  const [activityOpen, setActivityOpen] = useState(false);
  const client = useQueryClient();
  const heading = useRef<HTMLHeadingElement>(null);
  const validVideo = Number.isSafeInteger(videoId) && videoId > 0;
  const query = useQuery({
    queryKey: watchReportKey(videoId),
    queryFn: ({ signal }) => fetchWatchReport(videoId, signal),
    enabled: validVideo, refetchInterval: 30_000, retry: 1,
  });
  const video = useQuery({
    queryKey: watchLogQueryKeys.title(videoId),
    queryFn: ({ signal }) => fetchVideoDetail(videoId, signal),
    enabled: validVideo, staleTime: 60_000, retry: 1,
  });
  useEffect(() => { heading.current?.focus(); }, [studentId, videoId]);
  const base = `${teacher ? "/workspace/mobile" : "/workspace"}/videos/${videoId}/logs`;
  const back = watchLogsReturnPath(searchParams.get("returnTo"), videoId, teacher);
  const term = searchParams.get("q") ?? "";
  const data = query.data;
  const reachedOnly = searchParams.get("reached") === "1" && (data?.threshold_ms ?? 0) > 0;
  const selected = data?.students.find(row => row.student_id === studentId);
  const rows = data?.students.filter(row =>
    row.student_name.toLocaleLowerCase().includes(term.trim().toLocaleLowerCase()) &&
    (!reachedOnly || (data.threshold_ms > 0 && row.used_ms >= data.threshold_ms))) ?? [];
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const rawPage = Number(searchParams.get("page") || 1);
  const page = Math.min(pages, Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1);
  const setFilter = (name: string, value: string) => {
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      if (value) next.set(name, value); else next.delete(name);
      if (name !== "page") next.delete("page");
      return next;
    }, { replace: true });
  };
  const retry = () => { void query.refetch(); void video.refetch(); void client.invalidateQueries({ queryKey: watchLogQueryKeys.activityScope(videoId) }); };

  return <main className={`watch-logs${teacher ? " watch-logs--teacher" : ""}`} aria-labelledby="watch-logs-heading">
    <nav className="watch-logs__trail" aria-label="시청 기록 경로">
      <Link to={back}>{back === "/workspace/videos" ? "영상 목록" : "영상 상세"}</Link><span aria-hidden="true">/</span>
      {studentId !== null ? <><Link to={`${base}?${searchParams}`}>시청 로그</Link><span aria-hidden="true">/</span><span>학생 상세</span></> : <span>시청 로그</span>}
    </nav>
    <header className="watch-logs__header">
      <div><p className="watch-logs__video">{video.data?.title ?? "영상 시청 기록"}</p>
        <h1 id="watch-logs-heading" ref={heading} tabIndex={-1}>{studentId !== null ? `${selected?.student_name ?? "학생"} · 시청 상세` : "시청 로그"}</h1>
        <p>{studentId !== null ? "이 영상의 누적 재생시간과 활동 기록을 확인합니다." : "누적 재생시간이 많은 학생부터 확인하고, 학생을 선택해 기록을 살펴보세요."}</p>
      </div>
      <Button intent="secondary" size="sm" disabled={query.isFetching || video.isFetching} onClick={retry}>{query.isFetching ? "갱신 중…" : "새로고침"}</Button>
    </header>
    {!validVideo || query.isError || video.isError ? <section className="watch-logs__state" role="alert">
      <h2>시청 기록을 불러오지 못했습니다</h2><p>영상 접근 권한과 연결 상태를 확인한 뒤 다시 시도해 주세요.</p>
      {validVideo && <Button onClick={retry}>다시 불러오기</Button>}
    </section> : !data || !video.data ? <p role="status">시청 기록을 불러오는 중…</p> : studentId !== null ? <>
      <Link className="watch-logs__back" to={`${base}?${searchParams}`}>← 학생 목록으로</Link>
      {!selected ? <section className="watch-logs__state"><h2>이 학생의 누적 재생 기록이 없습니다</h2><p>학생 목록에서 집계된 학생을 다시 선택해 주세요.</p></section> : <>
        <section className="watch-logs__summary" aria-label="학생 누적 재생 요약">
          <dl><div><dt>누적 재생시간</dt><dd>{watchDuration(selected.used_ms)}</dd></div>
            <div><dt>원본 대비</dt><dd>{data.duration ? `${(selected.used_ms / (data.duration * 1000)).toFixed(2)}배` : "원본 길이 미확인"}</dd></div>
            <div><dt>현재 시간 제한</dt><dd>{data.enabled ? `켜짐 · ${watchDuration(data.threshold_ms)}` : "꺼짐"}</dd></div>
            <div><dt>누적 집계 시작</dt><dd>{new Date(selected.started_at).toLocaleString("ko-KR")}</dd></div></dl>
          {data.threshold_ms > 0 && selected.used_ms >= data.threshold_ms && <p className="watch-logs__notice">원본의 1.4배 이상 재생한 기록입니다. 반복 학습일 수 있으므로 계정 공유 여부는 추가 확인이 필요합니다.</p>}
          <p className="watch-logs__muted">집계를 시작한 뒤 재생한 시간을 합산하며, 되감아 다시 본 시간도 포함합니다. 진도율·접속 시간과는 다릅니다.</p>
        </section>
        <VideoLogTab key={`${videoId}:${studentId}`} videoId={videoId} studentId={studentId} />
      </>}
    </> : <>
      <div className="watch-logs__toolbar">
        <label className="watch-logs__search">학생 이름 검색<input type="search" value={term} onChange={e => setFilter("q", e.target.value)} placeholder="이름으로 찾기" /></label>
        <label className="watch-logs__check"><input type="checkbox" disabled={data.threshold_ms <= 0} checked={reachedOnly} onChange={e => setFilter("reached", e.target.checked ? "1" : "")} />원본의 1.4배 이상만</label>
        {data.threshold_ms <= 0 && <p className="watch-logs__muted">원본 길이를 확인하면 배율로 비교할 수 있습니다.</p>}
      </div>
      <div className="watch-logs__list-caption"><span>학생 {rows.length.toLocaleString()}명 · 누적시간 많은 순</span><span>30초마다 갱신 · 시간 제한 {data.enabled ? "켜짐" : "꺼짐"}</span></div>
      <section className="watch-logs__list" aria-label="학생별 누적 재생시간">
        <div className="watch-logs__columns" aria-hidden="true"><span>학생</span><span>누적 재생시간</span><span>원본 대비</span><span /></div>
        {rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(row => <Link key={row.student_id} className="watch-logs__student" to={`${base}/${row.student_id}?${searchParams}`}>
          <strong>{row.student_name}</strong><span><small>누적</small>{watchDuration(row.used_ms)}</span>
          <span>{data.duration ? `${(row.used_ms / (data.duration * 1000)).toFixed(2)}배` : "길이 미확인"}{data.threshold_ms > 0 && row.used_ms >= data.threshold_ms && <Badge tone="warning">기준 도달</Badge>}</span>
          <span className="watch-logs__detail-label">상세 보기 →</span>
        </Link>)}
        {!rows.length && <div className="watch-logs__state"><h2>{term || reachedOnly ? "조건에 맞는 학생이 없습니다" : "아직 누적 재생 기록이 없습니다"}</h2><p>{term || reachedOnly ? "검색어나 기준 필터를 바꿔 보세요." : "학생이 영상을 재생하면 누적 시간이 이곳에 표시됩니다."}</p>
          {(term || reachedOnly) && <Button intent="secondary" onClick={() => setSearchParams(previous => { const next = new URLSearchParams(previous); ["q", "reached", "page"].forEach(k => next.delete(k)); return next; }, { replace: true })}>필터 초기화</Button>}</div>}
      </section>
      {pages > 1 && <nav className="watch-logs__pagination" aria-label="학생 목록 페이지"><Button intent="ghost" disabled={page <= 1} onClick={() => setFilter("page", String(page - 1))}>이전</Button><span>{page} / {pages}</span><Button intent="ghost" disabled={page >= pages} onClick={() => setFilter("page", String(page + 1))}>다음</Button></nav>}
      <p className="watch-logs__muted">누적 시간은 집계 시작 이후의 기록입니다. 시간 제한을 꺼도 계속 집계하며, 기준 도달만으로 부정 이용을 단정하지 않습니다.</p>
      <details className="watch-logs__activity" onToggle={e => setActivityOpen(e.currentTarget.open)}><summary>전체 학생의 활동 기록</summary>{activityOpen && <VideoLogTab videoId={videoId} />}</details>
    </>}
  </main>;
}
