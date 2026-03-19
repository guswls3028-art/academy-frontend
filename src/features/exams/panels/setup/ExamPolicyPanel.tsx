/**
 * ExamPolicyPanel – FINAL / HUMAN / SAFE
 *
 * - 커트라인 / 진행 상태
 * - 답안 등록: "답안등록하기" 버튼 → 모달(문항 수·기본 점수·문항 반영 + 정답표)
 * - PDF 업로드: "시험지 PDF 업로드" 버튼 → ExamPdfUploadModal
 */

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAdminExam } from "../../hooks/useAdminExam";
import { updateAdminExam } from "../../api/adminExam";
import { fetchQuestionsByExam } from "../../api/questionApi";
import { fetchAnswerKeyByExam } from "../../api/answerKeyApi";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { resolveTenantCode, getTenantIdFromCode, getTenantBranding } from "@/shared/tenant";
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
  const { data: answerKey } = useQuery({
    queryKey: ["answer-key", examId],
    queryFn: () => fetchAnswerKeyByExam(examId).then((r) => r.data?.[0] ?? null),
    enabled: examId > 0,
  });

  const canEditQuestions = exam?.exam_type === "template";

  // OMR spec
  const omrSpec = useMemo(() => {
    if (!questions || questions.length === 0) return null;
    const answers = answerKey?.answers ?? {};
    let choiceCount = 0;
    let essayCount = 0;
    for (const q of questions) {
      const ans = String(answers[String(q.id)] ?? "").trim();
      const isChoice = ["1", "2", "3", "4", "5"].includes(ans);
      if (isChoice) choiceCount++;
      else essayCount++;
    }
    return { choiceCount, essayCount, total: choiceCount + essayCount };
  }, [questions, answerKey]);

  const openOmrSheet = () => {
    if (!exam || !omrSpec) return;
    let logoUrl = "/omr-default-logo.svg";
    try {
      const r = resolveTenantCode();
      if (r.ok) {
        const id = getTenantIdFromCode(r.code);
        if (id) {
          const b = getTenantBranding(id);
          if (b?.logoUrl) logoUrl = b.logoUrl;
        }
      }
    } catch { /* fallback */ }
    const params = new URLSearchParams({
      exam: exam.title || "시험",
      mc: String(omrSpec.choiceCount),
      essay: String(omrSpec.essayCount),
      choices: "5",
      logo: logoUrl,
    });
    window.open(`/omr-sheet.html?${params.toString()}&action=download`, "_blank");
  };

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
          structureOwnerId={exam.id}
          canEditQuestions={canEditQuestions}
          lectureName={resolvedLectureName}
          sessionName={resolvedSessionName}
        />

        <ExamPdfUploadModal
          open={pdfModalOpen}
          onClose={() => setPdfModalOpen(false)}
          examId={examId}
        />

        {/* ── OMR 답안지 출력 ── */}
        {omrSpec && omrSpec.total > 0 && (
          <div className="space-y-3 border-t border-[var(--border-divider)] pt-4">
            <div>
              <div className="text-sm font-semibold text-[var(--text-primary)]">OMR 답안지</div>
              <div className="mt-0.5 text-xs text-[var(--text-muted)]">
                객관식 {omrSpec.choiceCount}문항
                {omrSpec.essayCount > 0 && ` · 서술형 ${omrSpec.essayCount}문항`}
                {" "}· 총 {omrSpec.total}문항 기준으로 답안지를 출력합니다.
              </div>
            </div>
            <Button
              type="button"
              intent="secondary"
              size="sm"
              onClick={openOmrSheet}
            >
              OMR 답안지 PDF 다운로드
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
