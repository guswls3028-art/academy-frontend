import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import { Button } from "@/shared/ui/ds";
import { reviewWatchTime, type ReviewWatchSummary } from "./reviewWatchSummary";
import { watchReportKey, type WatchReport, type WatchStudent } from "./watchLogs";

function draftTime(ms: number) {
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function allowanceMilliseconds(value: string): number | null {
  const match = value.trim().match(/^(\d{1,6})(?::([0-5]\d))?$/);
  if (!match) return null;
  return Number(match[1]) * 60_000 + Number(match[2] ?? 0) * 1000;
}

export default function VideoReviewAllowanceEditor({ videoId, student, enabled, defaultLimit }: {
  videoId: number; student: WatchStudent; enabled: boolean; defaultLimit: number;
}) {
  const client = useQueryClient();
  const [draft, setDraft] = useState<{ value: string; exactMs: number | null; revision: string; useDefault: boolean } | null>(null);
  const [saved, setSaved] = useState(false);
  const canEdit = enabled && Boolean(student.revision) && student.limit_ms != null && student.can_adjust !== false;
  const unavailableMessage = !enabled ? "영상의 시간 제한이 꺼져 있어 제한 없이 복습할 수 있습니다."
    : "영상 길이와 학생의 현재 수강·시청 권한을 확인한 뒤 한도를 조정할 수 있습니다.";
  const applyConfirmedSummary = async (summary: ReviewWatchSummary) => {
    await client.cancelQueries({ queryKey: watchReportKey(videoId) });
    client.setQueryData<WatchReport>(watchReportKey(videoId), current => current ? {
      ...current,
      enabled: summary.enabled,
      students: current.students.map(row => row.student_id === student.student_id ? {
        ...row, ...summary, review_watch_summary: summary,
      } : row),
    } : current);
  };
  const save = useMutation({
    mutationFn: (change: { limit_ms: number | null; expected_revision: string }) =>
      api.patch<ReviewWatchSummary>(`/media/videos/${videoId}/review-watch/students/${student.student_id}/allowance/`, change),
    onSuccess: async response => {
      await applyConfirmedSummary(response.data);
      await client.invalidateQueries({ queryKey: watchReportKey(videoId) });
      setDraft(null);
      setSaved(true);
    },
    onError: async error => {
      const response = (error as { response?: { status: number; data?: ReviewWatchSummary } }).response;
      if (response?.status === 409 && response.data?.revision) await applyConfirmedSummary(response.data);
      await client.invalidateQueries({ queryKey: watchReportKey(videoId) });
    },
  });
  const open = () => {
    if (!canEdit || !student.revision || student.limit_ms == null) return;
    save.reset(); setSaved(false);
    setDraft({ value: draftTime(student.limit_ms), exactMs: student.limit_ms, revision: student.revision, useDefault: false });
  };
  const nextLimit = draft?.useDefault ? defaultLimit : draft ? draft.exactMs ?? allowanceMilliseconds(draft.value) : null;
  const conflict = (save.error as { response?: { status?: number } } | null)?.response?.status === 409;
  if (!student.revision || student.limit_ms === undefined) return null;
  return <section className="watch-allowance" aria-label="학생 복습 한도 조정">
    {saved && <p role="status">복습 한도를 저장했습니다. 학생이 영상을 다시 열거나 한도 변경을 확인하면 적용됩니다.</p>}
    {!draft ? <>
      {canEdit ? <Button intent="secondary" size="sm" onClick={open}>복습 한도 조정</Button> : <p className="watch-logs__muted">{unavailableMessage}</p>}
    </> : <div className="watch-allowance__form">
      <h3>{student.student_name} · 이 영상의 복습 한도</h3>
      <p>사용한 {reviewWatchTime(student.used_ms)}는 보존하며 총 허용시간만 바꿉니다. 수업 시청과 다른 영상에는 영향을 주지 않습니다.</p>
      {!canEdit && <p role="alert">{unavailableMessage} 입력은 보존했습니다. 현재 설정을 확인하고 새로고침하거나 편집을 취소해 주세요.</p>}
      <label>총 허용시간 (분 또는 분:초)
        <input inputMode="numeric" value={draft.value} disabled={save.isPending || !canEdit}
          onChange={event => setDraft({ ...draft, value: event.target.value, exactMs: null, useDefault: false })} />
      </label>
      <div className="watch-allowance__actions">
        {[10, 30].map(minutes => <Button key={minutes} intent="secondary" size="sm" disabled={save.isPending || !canEdit} onClick={() => {
          const exactMs = (nextLimit ?? student.limit_ms ?? 0) + minutes * 60_000;
          setDraft({ ...draft, value: draftTime(exactMs), exactMs, useDefault: false });
        }}>+{minutes}분</Button>)}
        <Button intent="ghost" size="sm" disabled={save.isPending || !canEdit} aria-pressed={draft.useDefault} onClick={() => setDraft({ ...draft, value: draftTime(defaultLimit), exactMs: defaultLimit, useDefault: true })}>기본 1.4배 적용</Button>
      </div>
      {nextLimit !== null ? <p className={nextLimit <= student.used_ms ? "watch-logs__notice" : ""}>
        변경 후 허용 {reviewWatchTime(nextLimit)} · 남음 {reviewWatchTime(Math.max(0, nextLimit - student.used_ms))}
        {nextLimit <= student.used_ms ? " · 저장하면 추가 복습 재생이 중단됩니다." : ""}
      </p> : <p role="alert">0 이상의 분 또는 분:초를 입력해 주세요. 예: 90 또는 90:30</p>}
      {save.isError && canEdit && <div role="alert">
        <p>{conflict ? "다른 선생님이 한도나 영상 설정을 변경했습니다. 현재 한도를 확인한 뒤 다시 편집해 주세요." : "저장 결과를 확인하지 못했습니다. 현재 한도를 확인하거나 다시 시도해 주세요."}</p>
        <p>현재 허용시간: {student.limit_ms === null ? "제한 없음" : reviewWatchTime(student.limit_ms ?? 0)}</p>
        <Button intent="secondary" size="sm" onClick={open}>현재 한도로 다시 편집</Button>
      </div>}
      <div className="watch-allowance__actions">
        <Button size="sm" disabled={!canEdit || nextLimit === null || save.isPending || conflict} onClick={() => {
          if (canEdit && nextLimit !== null) save.mutate({ limit_ms: draft.useDefault ? null : nextLimit, expected_revision: draft.revision });
        }}>{save.isPending ? "저장 중…" : "한도 저장"}</Button>
        <Button intent="ghost" size="sm" disabled={save.isPending} onClick={() => { setDraft(null); save.reset(); }}>취소</Button>
      </div>
    </div>}
  </section>;
}
