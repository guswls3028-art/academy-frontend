/**
 * ExamPolicyPanel – FINAL / HUMAN / SAFE
 *
 * - 커트라인 / 진행 상태
 * - 답안 등록: "답안등록하기" 버튼 → 모달(문항 수·기본 점수·문항 반영 + 정답표)
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
import { useRef } from "react";

export default function ExamPolicyPanel({ examId }: { examId: number }) {
  const qc = useQueryClient();
  const { data: exam, isLoading } = useAdminExam(examId);

  const [passScore, setPassScore] = useState<number | "">("");
  const [savedScore, setSavedScore] = useState<number | "">("");
  const [answerModalOpen, setAnswerModalOpen] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [pdfUploading, setPdfUploading] = useState(false);

  useEffect(() => {
    if (!exam) return;
    const ps = Number(exam.pass_score);
    const value = Number.isFinite(ps) && ps >= 0 ? ps : "";
    setPassScore(value);
    setSavedScore(value);
  }, [exam?.id]);

  const isDirty = useMemo(
    () => passScore !== savedScore,
    [passScore, savedScore]
  );

  const numericPassScore = typeof passScore === "number" ? passScore : 0;

  const patchMut = useMutation({
    mutationFn: (payload: { pass_score: number }) => updateAdminExam(examId, payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin-exam", examId] });
      feedback.success("저장되었습니다.");
    },
    onError: (e: any) => {
      feedback.error(e?.response?.data?.detail ?? "저장에 실패했습니다.");
    },
  });

  if (isLoading || !exam) {
    return (
      <section className="rounded border border-[var(--border-divider)] bg-[var(--bg-surface-soft)] p-4 text-sm text-[var(--text-muted)]">
        시험 정책을 불러오는 중입니다…
      </section>
    );
  }

  const canEditQuestions = exam.exam_type === "template";

  // ── OMR: 문항 수 파악 ──
  const questionsQ = useQuery({
    queryKey: ["exam-questions", examId],
    queryFn: () => fetchQuestionsByExam(examId).then((r) => r.data),
    enabled: Number.isFinite(examId),
  });
  const answerKeyQ = useQuery({
    queryKey: ["answer-key", examId],
    queryFn: () => fetchAnswerKeyByExam(examId).then((r) => r.data),
    enabled: Number.isFinite(examId),
  });

  const omrSpec = useMemo(() => {
    const questions = questionsQ.data ?? [];
    const ak = answerKeyQ.data?.[0];
    if (!questions.length) return null;
    const answers = ak?.answers ?? {};
    // choice questions: answer is "1"~"5", essay: anything else
    let choiceCount = 0;
    let essayCount = 0;
    for (const q of questions) {
      const ans = answers[String(q.id)] ?? "";
      const isChoice = /^[1-5]$/.test(ans);
      if (isChoice) choiceCount++;
      else essayCount++;
    }
    // If no answer key, assume all choice
    if (!ak) {
      choiceCount = questions.length;
      essayCount = 0;
    }
    return { choiceCount, essayCount, total: questions.length };
  }, [questionsQ.data, answerKeyQ.data]);

  const openOmrSheet = () => {
    if (!omrSpec) return;
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
    window.open(`/omr-sheet.html?${params.toString()}`, "_blank");
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
                  e.preventDefault();
                  savePassScore();
                }
              }}
              placeholder="입력"
              className="w-[180px] rounded border border-[var(--border-divider)] px-3 py-2 text-4xl font-bold"
              disabled={patchMut.isPending}
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
              onClick={() => pdfInputRef.current?.click()}
              disabled={pdfUploading}
            >
              {pdfUploading ? "분석 중…" : "📄 PDF 업로드"}
            </Button>
            <input
              ref={pdfInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              style={{ display: "none" }}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                e.target.value = "";
                setPdfUploading(true);
                try {
                  const { default: api } = await import("@/shared/api/axios");
                  const formData = new FormData();
                  formData.append("file", f);
                  formData.append("exam_id", String(examId));
                  const res = await api.post("/exams/pdf-extract/", formData, {
                    headers: { "Content-Type": "multipart/form-data" },
                  });
                  feedback.success("PDF 문항 분할이 시작되었습니다.");
                  const jobId = res.data?.job_id;
                  if (jobId) {
                    const poll = setInterval(async () => {
                      try {
                        const { default: api2 } = await import("@/shared/api/axios");
                        const sr = await api2.get("/jobs/" + jobId + "/");
                        const s = sr.data?.status;
                        if (s === "DONE" || s === "done") {
                          clearInterval(poll); setPdfUploading(false);
                          feedback.success("문항 분할 완료!");
                        } else if (s === "FAILED" || s === "failed") {
                          clearInterval(poll); setPdfUploading(false);
                          feedback.error("문항 분할 실패");
                        }
                      } catch { clearInterval(poll); setPdfUploading(false); }
                    }, 3000);
                    setTimeout(() => { clearInterval(poll); setPdfUploading(false); }, 120000);
                  } else { setPdfUploading(false); }
                } catch (err: any) {
                  feedback.error(err?.response?.data?.detail ?? "PDF 업로드 실패");
                  setPdfUploading(false);
                }
              }}
            />
          </div>
        </div>

        <AnswerKeyRegisterModal
          open={answerModalOpen}
          onClose={() => setAnswerModalOpen(false)}
          examId={examId}
          structureOwnerId={exam.id}
          canEditQuestions={canEditQuestions}
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
              OMR 답안지 출력
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
