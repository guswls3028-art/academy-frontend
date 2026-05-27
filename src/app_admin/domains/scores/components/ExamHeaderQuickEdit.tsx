/**
 * ExamHeaderQuickEdit
 *
 * 성적탭 시험 컬럼 헤더 ⚙ 버튼 → AdminModal 로 시험명/만점/커트라인 한번에 편집.
 *
 * 2026-05-13 학원장 보고: "테이블에서 총점변경 UI/UX가 너무 짜침" → popover 폐기, 정식 모달로.
 *  - 좁은 absolute popover: 입력 칸 작고, viewport 좁으면 잘림, 다른 element 가림.
 *  - AdminModal: 폭 확보 + 키보드 흐름 + ESC/배경 클릭 닫기 + 디자인 정합.
 */

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { feedback } from "@/shared/ui/feedback/feedback";
import { extractApiError } from "@/shared/utils/extractApiError";
import { updateAdminExam } from "@admin/domains/exams/api/adminExam";
import { sessionAssessmentQueryKeys } from "@admin/domains/sessions/api/sessionAssessmentQueries";
import { scoresQueryKeys } from "../api/queryKeys";
import ShowcasePublishModal from "./ShowcasePublishModal";
import { AdminModal, ModalHeader, ModalBody, ModalFooter, MODAL_WIDTH } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";

type Props = {
  examId: number;
  examTitle: string;
  initialMaxScore: number | null;
  initialPassScore: number | null;
  sessionId: number;
};

export default function ExamHeaderQuickEdit({
  examId,
  examTitle,
  initialMaxScore,
  initialPassScore,
  sessionId,
}: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [showcaseOpen, setShowcaseOpen] = useState(false);
  const [title, setTitle] = useState<string>(examTitle);
  const [maxScore, setMaxScore] = useState<number | "">(initialMaxScore ?? 100);
  const [passScore, setPassScore] = useState<number | "">(initialPassScore ?? 0);

  useEffect(() => {
    if (!open) return;
    // 모달 열릴 때마다 latest 값으로 동기화
    setTitle(examTitle);
    setMaxScore(initialMaxScore ?? 100);
    setPassScore(initialPassScore ?? 0);
  }, [open, examTitle, initialMaxScore, initialPassScore]);

  const saveMut = useMutation({
    mutationFn: () => {
      const ms = typeof maxScore === "number" ? maxScore : 100;
      const ps = typeof passScore === "number" ? passScore : 0;
      const t = (title ?? "").trim() || examTitle;
      if (ps > ms) throw new Error(`커트라인(${ps})이 만점(${ms})보다 클 수 없습니다.`);
      return updateAdminExam(examId, { title: t, max_score: ms, pass_score: ps });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: scoresQueryKeys.sessionScores(sessionId) });
      await qc.invalidateQueries({ queryKey: ["admin-exam", examId] });
      await qc.invalidateQueries({ queryKey: sessionAssessmentQueryKeys.exams(sessionId) });
      feedback.success(`${title || examTitle} 저장됨`);
      setOpen(false);
    },
    onError: (e: unknown) => {
      feedback.error(extractApiError(e, "저장 실패"));
    },
  });

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className="text-[11px] leading-none px-1 py-0.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-brand-primary)] hover:bg-[var(--color-bg-surface-hover)]"
        title="시험 설정 — 시험명/만점/커트라인 수정"
        aria-label={`${examTitle} 시험 설정 편집`}
      >
        ⚙
      </button>

      <AdminModal
        open={open}
        onClose={() => !saveMut.isPending && setOpen(false)}
        type="action"
        width={MODAL_WIDTH.md}
        onEnterConfirm={() => { if (!saveMut.isPending) saveMut.mutate(); }}
      >
        <ModalHeader type="action" title="시험 설정" subtitle={examTitle} />
        <ModalBody>
          <div className="flex flex-col gap-4">
            {/* 시험명 */}
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-[var(--color-text-primary)]">
                시험명
              </span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="ds-input w-full"
                placeholder="예) 중간고사"
                autoFocus
              />
            </label>

            {/* 만점 + 커트라인 가로 배치 */}
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-[var(--color-text-primary)]">
                  만점
                </span>
                <input
                  type="number"
                  min={1}
                  value={maxScore}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "") { setMaxScore(""); return; }
                    const n = parseInt(v, 10);
                    setMaxScore(Number.isFinite(n) ? n : "");
                  }}
                  className="ds-input w-full"
                />
                <span className="mt-1 block text-[11px] text-[var(--color-text-muted)]">
                  점수 입력 시 최대 한도
                </span>
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-[var(--color-text-primary)]">
                  커트라인 (합격선)
                </span>
                <input
                  type="number"
                  min={0}
                  value={passScore}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "") { setPassScore(""); return; }
                    const n = parseInt(v, 10);
                    setPassScore(Number.isFinite(n) ? n : "");
                  }}
                  className="ds-input w-full"
                />
                <span className="mt-1 block text-[11px] text-[var(--color-text-muted)]">
                  이 점수 이상 = 이수, 미만 = 클리닉 대상
                </span>
              </label>
            </div>

            {/* 홈페이지 게시 (Phase #13) — 별도 액션 */}
            <div className="mt-2 pt-3 border-t border-[var(--color-border-divider)]">
              <button
                type="button"
                onClick={() => { setOpen(false); setShowcaseOpen(true); }}
                className="ds-button w-full"
                data-intent="secondary"
                data-size="md"
                title="이 시험의 익명 석차·점수를 학원 홈페이지에 자동 노출합니다"
                data-testid={`showcase-publish-trigger-${examId}`}
              >
                🌐 학원 홈페이지에 성적 통계 게시
              </button>
            </div>
          </div>
        </ModalBody>
        <ModalFooter
          right={
            <>
              <Button
                intent="ghost"
                size="sm"
                onClick={() => setOpen(false)}
                disabled={saveMut.isPending}
              >
                취소
              </Button>
              <Button
                intent="primary"
                size="sm"
                onClick={() => saveMut.mutate()}
                disabled={saveMut.isPending}
              >
                {saveMut.isPending ? "저장 중…" : "저장"}
              </Button>
            </>
          }
        />
      </AdminModal>

      <ShowcasePublishModal
        open={showcaseOpen}
        onClose={() => setShowcaseOpen(false)}
        examId={examId}
        examTitle={examTitle}
      />
    </>
  );
}
