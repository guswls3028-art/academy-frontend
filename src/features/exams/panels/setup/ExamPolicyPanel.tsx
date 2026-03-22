/**
 * ExamPolicyPanel – FINAL / HUMAN / SAFE
 *
 * - 커트라인 / 진행 상태
 * - 답안 등록: "답안등록하기" 버튼 → 모달(문항 수·기본 점수·문항 반영 + 정답표)
 * - PDF 업로드: "시험지 PDF 업로드" 버튼 → ExamPdfUploadModal
 */

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAdminExam } from "../../hooks/useAdminExam";
import { updateAdminExam } from "../../api/adminExam";
import { fetchQuestionsByExam } from "../../api/questionApi";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import AnswerKeyRegisterModal from "../../components/AnswerKeyRegisterModal";
import ExamPdfUploadModal from "../../components/ExamPdfUploadModal";
import { fetchLectures, fetchSessions } from "@/features/lectures/api/sessions";

export default function ExamPolicyPanel({ examId, lectureId = 0, sessionId = 0 }: { examId: number; lectureId?: number; sessionId?: number }) {
  const qc = useQueryClient();
  const { data: exam, isLoading } = useAdminExam(examId);

  const [passScore, setPassScore] = useState<number | "">("");
  const [savedScore, setSavedScore] = useState<number | "">("");
  const [answerModalOpen, setAnswerModalOpen] = useState(false);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);

  // 강의명/차시명 조회 (OMR 기본값 주입용)
  const { data: lectureData } = useQuery({
    queryKey: ["lectures-for-omr"],
    queryFn: () => fetchLectures(),
    enabled: lectureId > 0,
  });
  const { data: sessionData } = useQuery({
    queryKey: ["sessions-for-omr", lectureId],
    queryFn: () => fetchSessions(lectureId),
    enabled: lectureId > 0,
  });
  const resolvedLectureName = lectureData?.find((l: any) => l.id === lectureId)?.title ?? "";
  const resolvedSessionName = sessionData?.find((s: any) => s.id === sessionId)?.title ?? "";

  useEffect(() => {
    if (!exam) return;
    const ps = Number(exam.pass_score);
    const value = Number.isFinite(ps) && ps >= 0 ? ps : "";
    setPassScore(value);
    setSavedScore(value);
  }, [exam?.id, exam?.pass_score]);

  const numericPassScore = typeof passScore === "number" ? passScore : 0;
  const isDirty = passScore !== savedScore;

  const patchMut = useMutation({
    mutationFn: (data: { pass_score: number }) => updateAdminExam(examId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-exam", examId] });
      feedback.success("커트라인이 저장되었습니다.");
    },
    onError: (e: unknown) => {
      feedback.error((e as Error)?.message ?? "저장에 실패했습니다.");
    },
  });

  // Questions + AnswerKey for OMR spec
  const { data: questions = [] } = useQuery({
    queryKey: ["exam-questions", examId],
    queryFn: () => fetchQuestionsByExam(examId).then((r) => r.data),
    enabled: examId > 0,
  });
  const canEditQuestions = exam?.exam_type === "template";

  const savePassScore = async () => {
    try {
      await patchMut.mutateAsync({
        pass_score: numericPassScore,
      });
      setSavedScore(passScore);
    } catch {
      // onError에서 이미 feedback 처리
    }
  };

  if (!exam || isLoading) {
    return null;
  }

  return (
    <section className="rounded border border-[var(--border-divider)] bg-[var(--bg-surface)]">
      <div className="border-b border-[var(--border-divider)] px-4 py-3">
        <div className="text-sm font-semibold text-[var(--text-primary)]">시험 정책</div>
        <div className="mt-0.5 text-xs text-[var(--text-muted)]">
          커트라인을 설정합니다
        </div>
      </div>

      <div className="space-y-6 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <div className="mb-1 text-sm text-[var(--text-muted)]">커트라인</div>
            <input
              type="number"
              min={0}
              step={1}
              value={passScore === "" ? "" : passScore}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "") {
                  setPassScore("");
                  return;
                }
                const num = parseInt(v, 10);
                setPassScore(Number.isFinite(num) ? num : "");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (isDirty && !patchMut.isPending)) {
                  savePassScore();
                }
              }}
              className="w-24 rounded border border-[var(--border-divider)] px-2 py-1.5 text-sm text-[var(--text-primary)]"
            />
          </div>
          <Button
            type="button"
            intent="primary"
            size="md"
            onClick={savePassScore}
            disabled={!isDirty || patchMut.isPending}
          >
            저장
          </Button>
        </div>

        <div className="space-y-3">
          <div>
            <div className="text-sm font-semibold text-[var(--text-primary)]">답안 등록</div>
            <div className="mt-0.5 text-xs text-[var(--text-muted)]">
              문항별 정답을 입력하고 저장합니다. 채점 시 사용됩니다.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              intent="secondary"
              size="sm"
              onClick={() => setAnswerModalOpen(true)}
            >
              답안등록하기
            </Button>
            <Button
              type="button"
              intent="ghost"
              size="sm"
              onClick={() => setPdfModalOpen(true)}
            >
              시험지 PDF 업로드
            </Button>
          </div>
        </div>

        <AnswerKeyRegisterModal
          open={answerModalOpen}
          onClose={() => setAnswerModalOpen(false)}
          examId={examId}
          structureOwnerId={exam.template_exam_id ?? exam.id}
          canEditQuestions={canEditQuestions}
          lectureName={resolvedLectureName}
          sessionName={resolvedSessionName}
        />

        <ExamPdfUploadModal
          open={pdfModalOpen}
          onClose={() => setPdfModalOpen(false)}
          examId={exam?.template_exam_id ?? examId}
        />

        {/* ── OMR 답안지 ── */}
        {questions.length > 0 && (
          <div className="space-y-3 border-t border-[var(--border-divider)] pt-4">
            <div>
              <div className="text-sm font-semibold text-[var(--text-primary)]">OMR 답안지</div>
              <div className="mt-0.5 text-xs text-[var(--text-muted)]">
                총 {questions.length}문항. 답안등록 모달의 OMR 탭에서 문항 구성을 확인하고 다운로드하세요.
              </div>
            </div>
            <Button
              type="button"
              intent="secondary"
              size="sm"
              onClick={() => { setAnswerModalOpen(true); /* OMR 탭은 사용자가 직접 전환 */ }}
            >
              OMR 답안지 설정 및 다운로드
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
