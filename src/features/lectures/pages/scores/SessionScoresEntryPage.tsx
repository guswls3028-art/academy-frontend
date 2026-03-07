// PATH: src/features/lectures/pages/scores/SessionScoresEntryPage.tsx
/**
 * SessionScoresEntryPage — 성적 탭 (엑셀형 작업 플레이스)
 *
 * - DomainListToolbar + 테이블 위주, Tab/화살표로 셀 이동
 * - 시험 추가(차시 시험 탭 이동) / 과제 추가(단순 생성 모달)
 */

import { useState } from "react";
import { useParams, Link, useQueryClient } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import api from "@/shared/api/axios";

import SessionScoresPanel from "@/features/scores/panels/SessionScoresPanel";
import { Button, EmptyState } from "@/shared/ui/ds";
import { DomainListToolbar } from "@/shared/ui/domain";
import { createHomework } from "@/features/homework/api/homeworks";
import { feedback } from "@/shared/ui/feedback/feedback";

type Props = {
  onOpenEnrollModal?: () => void;
  onOpenStudentModal?: () => void;
};

async function fetchSessionScores(sessionId: number) {
  const res = await api.get(`/results/admin/sessions/${sessionId}/scores/`);
  return res.data as { meta: unknown; rows: { enrollment_id: number; student_name: string }[] };
}

export default function SessionScoresEntryPage({
  onOpenEnrollModal,
  onOpenStudentModal,
}: Props) {
  const { lectureId, sessionId: sessionIdParam } = useParams<{ lectureId: string; sessionId: string }>();
  const numericSessionId = Number(sessionIdParam);
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [addHomeworkOpen, setAddHomeworkOpen] = useState(false);
  const [addHomeworkTitle, setAddHomeworkTitle] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["session-scores", numericSessionId],
    queryFn: () => fetchSessionScores(numericSessionId),
    enabled: Number.isFinite(numericSessionId),
  });

  const createHomeworkMutation = useMutation({
    mutationFn: (title: string) =>
      createHomework({ session_id: numericSessionId, title: title.trim(), status: "OPEN" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["session-scores", numericSessionId] });
      feedback.success("과제가 추가되었습니다.");
      setAddHomeworkOpen(false);
      setAddHomeworkTitle("");
    },
    onError: (e: any) => {
      feedback.error(e?.response?.data?.detail ?? "과제 추가에 실패했습니다.");
    },
  });

  const totalCount = data?.rows?.length ?? 0;
  const examsLink =
    lectureId && sessionIdParam
      ? `/admin/lectures/${lectureId}/sessions/${sessionIdParam}/exams`
      : "#";

  if (!Number.isFinite(numericSessionId)) {
    return (
      <div className="p-6 text-sm" style={{ color: "var(--color-error)" }}>
        유효하지 않은 sessionId 입니다.
      </div>
    );
  }

  const primaryAction = (
    <div className="flex items-center gap-2">
      <Link to={examsLink}>
        <Button type="button" intent="secondary" size="sm">
          시험 추가
        </Button>
      </Link>
      <Button
        type="button"
        intent="secondary"
        size="sm"
        onClick={() => setAddHomeworkOpen(true)}
      >
        과제 추가
      </Button>
      {onOpenEnrollModal && (
        <Button type="button" intent="primary" size="sm" onClick={onOpenEnrollModal}>
          수강생 등록
        </Button>
      )}
      {onOpenStudentModal && (
        <Button type="button" intent="secondary" size="sm" onClick={onOpenStudentModal}>
          학생 추가
        </Button>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      <DomainListToolbar
        totalLabel={isLoading ? "…" : `총 ${totalCount}명`}
        searchSlot={
          <input
            type="search"
            className="ds-input"
            placeholder="이름 검색 (초성 검색 가능)"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ maxWidth: 280 }}
            aria-label="학생 이름 검색"
          />
        }
        filterSlot={null}
        primaryAction={primaryAction}
      />

      <p className="text-xs text-[var(--color-text-muted)]">
        <kbd className="px-1 py-0.5 rounded bg-[var(--color-bg-surface-soft)] font-mono">Tab</kbd> / <kbd className="px-1 py-0.5 rounded bg-[var(--color-bg-surface-soft)] font-mono">Enter</kbd> 셀 이동 ·
        숫자 입력 후 <kbd className="px-1 py-0.5 rounded bg-[var(--color-bg-surface-soft)] font-mono">Enter</kbd> 저장 ·
        <kbd className="px-1 py-0.5 rounded bg-[var(--color-bg-surface-soft)] font-mono">/</kbd>+<kbd className="px-1 py-0.5 rounded bg-[var(--color-bg-surface-soft)] font-mono">Enter</kbd> 미제출
      </p>

      {isLoading && (
        <EmptyState scope="panel" tone="loading" title="성적 불러오는 중…" />
      )}

      {!isLoading && isError && (
        <EmptyState scope="panel" tone="error" title="성적 로드 실패" />
      )}

      {!isLoading && !isError && (
        <SessionScoresPanel
          sessionId={numericSessionId}
          search={searchInput}
        />
      )}

      {addHomeworkOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => !createHomeworkMutation.isPending && setAddHomeworkOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-homework-title"
        >
          <div
            className="bg-[var(--color-bg-surface)] rounded-xl shadow-xl p-6 w-full max-w-md border border-[var(--color-border-divider)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="add-homework-title" className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
              과제 추가
            </h2>
            <p className="text-sm text-[var(--color-text-muted)] mb-3">
              제목만 입력하면 됩니다. 커트라인·설정은 생성된 과제에서 설정할 수 있습니다.
            </p>
            <input
              type="text"
              className="ds-input w-full mb-4"
              placeholder="예: 화학 중화반응"
              value={addHomeworkTitle}
              onChange={(e) => setAddHomeworkTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (addHomeworkTitle.trim()) createHomeworkMutation.mutate(addHomeworkTitle.trim());
                }
                if (e.key === "Escape") setAddHomeworkOpen(false);
              }}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                intent="secondary"
                onClick={() => !createHomeworkMutation.isPending && setAddHomeworkOpen(false)}
              >
                취소
              </Button>
              <Button
                type="button"
                intent="primary"
                disabled={!addHomeworkTitle.trim() || createHomeworkMutation.isPending}
                onClick={() => createHomeworkMutation.mutate(addHomeworkTitle.trim())}
              >
                {createHomeworkMutation.isPending ? "추가 중…" : "추가"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
