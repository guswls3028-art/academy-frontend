// PATH: src/features/exams/components/create/CreateRegularExamModal.tsx
// ------------------------------------------------------------------
// 시험 추가 모달 — 전역 모달 SSOT(AdminModal + Header/Body/Footer) 적용
// 한 화면에서 템플릿(선택형/서술형)·정답·배점 설정 후 한 번에 저장
// ------------------------------------------------------------------

import { useEffect, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import { updateAdminExam } from "@/features/exams/api/adminExam";
import { AdminModal, ModalHeader, ModalBody, ModalFooter, MODAL_WIDTH } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";

type ExamTemplate = {
  id: number;
  title: string;
  subject: string;
  hasAnswerKey?: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  sessionId: number;
  /** 강의 차시에서 열 때 전달하면 과목명 자동 입력 */
  lectureId?: number;
  onCreated: (examId: number) => void;
};

type Step = "select" | "template_design" | "regular_settings";

type QuestionRow = {
  type: "choice" | "subjective";
  number: number;
  score: number;
  answer: string;
};

async function checkAnswerKey(examId: number): Promise<boolean> {
  try {
    const res = await api.get("/exams/answer-keys/", { params: { exam: examId } });
    const d = res.data;
    const list = Array.isArray(d) ? d : Array.isArray(d?.results) ? d.results : d?.items ?? [];
    return list.length > 0;
  } catch {
    return false;
  }
}

/** 한 번에 템플릿+문항+정답 생성 (POST /exams/bulk-template/) */
async function createBulkTemplate(payload: {
  title: string;
  subject?: string;
  description?: string;
  questions: Array<{ number: number; score: number; answer: string }>;
}): Promise<number> {
  const res = await api.post("/exams/bulk-template/", payload);
  const id = res.data?.id;
  if (id == null) throw new Error("템플릿 생성 후 ID를 받지 못했습니다.");
  return Number(id);
}

function toLocalDatetime(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}`;
}

function fromLocalDatetime(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

const CHOICE_OPTIONS = ["1", "2", "3", "4", "5"];

export default function CreateRegularExamModal({
  open,
  onClose,
  sessionId,
  lectureId,
  onCreated,
}: Props) {
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>("select");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [templateId, setTemplateId] = useState<number | null>(null);

  const [templateTitle, setTemplateTitle] = useState("");
  const [templateSubject, setTemplateSubject] = useState("");

  const { data: lecture } = useQuery({
    queryKey: ["lecture", lectureId],
    queryFn: async () => {
      const res = await api.get(`/lectures/lectures/${lectureId}/`);
      return res.data;
    },
    enabled: !!lectureId && open,
  });

  useEffect(() => {
    if (open && lecture?.subject != null && lecture.subject !== "") {
      setTemplateSubject(String(lecture.subject).trim());
    }
  }, [open, lecture?.subject]);
  const [templateDescription, setTemplateDescription] = useState("");
  const [choiceRows, setChoiceRows] = useState<QuestionRow[]>([
    { type: "choice", number: 1, score: 1, answer: "1" },
    { type: "choice", number: 2, score: 1, answer: "1" },
    { type: "choice", number: 3, score: 1, answer: "1" },
    { type: "choice", number: 4, score: 1, answer: "1" },
    { type: "choice", number: 5, score: 1, answer: "1" },
  ]);
  const [subjectiveRows, setSubjectiveRows] = useState<QuestionRow[]>([]);

  const [openAt, setOpenAt] = useState("");
  const [closeAt, setCloseAt] = useState("");
  const [passScore, setPassScore] = useState(60);
  const [allowRetake, setAllowRetake] = useState(false);
  const [maxAttempts, setMaxAttempts] = useState(1);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [creatingTemplate, setCreatingTemplate] = useState(false);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["exam-templates-with-answerkey"],
    queryFn: async (): Promise<ExamTemplate[]> => {
      const res = await api.get("/exams/", { params: { exam_type: "template" } });
      const data = res.data;
      const raw = Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : [];
      const list = raw.map((t: any) => ({
        id: Number(t.id),
        title: String(t.title ?? ""),
        subject: String(t.subject ?? ""),
      }));
      const withKey = await Promise.all(
        list.map(async (t: ExamTemplate) => ({ ...t, hasAnswerKey: await checkAnswerKey(t.id) }))
      );
      return withKey;
    },
    enabled: open,
  });

  const selectableTemplates = templates.filter((t) => t.hasAnswerKey);
  const hasAnySelectable = selectableTemplates.length > 0;

  const allRows = [...choiceRows, ...subjectiveRows];
  const totalScore = allRows.reduce((s, q) => s + (Number(q.score) || 0), 0);

  useEffect(() => {
    if (!open) return;
    setStep("select");
    setTitle("");
    setDescription("");
    setTemplateId(null);
    setTemplateTitle("");
    setTemplateSubject("");
    setTemplateDescription("");
    setChoiceRows([
      { type: "choice", number: 1, score: 1, answer: "1" },
      { type: "choice", number: 2, score: 1, answer: "1" },
      { type: "choice", number: 3, score: 1, answer: "1" },
      { type: "choice", number: 4, score: 1, answer: "1" },
      { type: "choice", number: 5, score: 1, answer: "1" },
    ]);
    setSubjectiveRows([]);
    const now = new Date();
    const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    setOpenAt(toLocalDatetime(now));
    setCloseAt(toLocalDatetime(end));
    setPassScore(60);
    setAllowRetake(false);
    setMaxAttempts(1);
    setError(null);
    setSubmitting(false);
    setCreatingTemplate(false);
  }, [open]);

  useEffect(() => {
    if (!templateId) return;
    const ok = selectableTemplates.some((t) => t.id === templateId);
    if (!ok) setTemplateId(null);
  }, [templateId, selectableTemplates]);

  const updateChoice = useCallback((index: number, field: "score" | "answer", value: number | string) => {
    setChoiceRows((prev) => {
      const next = [...prev];
      if (field === "score") next[index] = { ...next[index], score: Number(value) || 1 };
      else next[index] = { ...next[index], answer: String(value) };
      return next;
    });
  }, []);
  const updateSubjective = useCallback((index: number, field: "score" | "answer", value: number | string) => {
    setSubjectiveRows((prev) => {
      const next = [...prev];
      if (field === "score") next[index] = { ...next[index], score: Number(value) || 1 };
      else next[index] = { ...next[index], answer: String(value) };
      return next;
    });
  }, []);

  const addChoice = useCallback(() => {
    setChoiceRows((prev) => [
      ...prev,
      { type: "choice", number: prev.length + 1, score: 1, answer: "1" },
    ]);
  }, []);
  const addSubjective = useCallback(() => {
    setSubjectiveRows((prev) => [
      ...prev,
      { type: "subjective", number: prev.length + 1, score: 1, answer: "" },
    ]);
  }, []);

  const removeChoice = useCallback((index: number) => {
    setChoiceRows((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.map((q, i) => ({ ...q, number: i + 1 }));
    });
  }, []);
  const removeSubjective = useCallback((index: number) => {
    setSubjectiveRows((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.map((q, i) => ({ ...q, number: i + 1 }));
    });
  }, []);

  const handleSaveTemplate = async () => {
    if (!templateTitle.trim()) {
      setError("템플릿 제목을 입력하세요.");
      return;
    }
    const questions = allRows.map((q, i) => ({
      number: i + 1,
      score: Number(q.score) || 1,
      answer: String(q.answer).trim() || "1",
    }));
    if (allRows.some((q) => q.type === "subjective" && !String(q.answer).trim())) {
      setError("서술형 문항의 정답을 모두 입력하세요.");
      return;
    }
    if (questions.length === 0) {
      setError("문항을 1개 이상 추가하세요.");
      return;
    }
    setError(null);
    setCreatingTemplate(true);
    try {
      const newId = await createBulkTemplate({
        title: templateTitle.trim(),
        ...(templateSubject.trim() ? { subject: templateSubject.trim() } : {}),
        description: templateDescription.trim(),
        questions,
      });
      await qc.invalidateQueries({ queryKey: ["exam-templates-with-answerkey"] });
      setTemplateId(newId);
      setStep("regular_settings");
    } catch (e: any) {
      setError(
        e?.response?.data?.detail ??
          (typeof e?.message === "string" ? e.message : "템플릿 저장에 실패했습니다.")
      );
    } finally {
      setCreatingTemplate(false);
    }
  };

  const validateRegular = () => {
    if (!title.trim()) return "시험 제목을 입력하세요.";
    if (!templateId) return "템플릿을 선택하세요.";
    if (!sessionId) return "세션 정보가 없습니다.";
    return null;
  };

  const handleSubmitRegular = async () => {
    const v = validateRegular();
    if (v) {
      setError(v);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.post("/exams/", {
        title: title.trim(),
        description: description.trim(),
        exam_type: "regular",
        template_exam_id: templateId,
        session_id: sessionId,
      });
      const newExamId = Number(res.data?.id);
      if (!newExamId) throw new Error("생성 후 ID를 받지 못했습니다.");

      const patchPayload: Parameters<typeof updateAdminExam>[1] = {
        pass_score: passScore,
        allow_retake: allowRetake,
        max_attempts: allowRetake ? maxAttempts : 1,
      };
      const openDate = fromLocalDatetime(openAt);
      const closeDate = fromLocalDatetime(closeAt);
      if (openDate) patchPayload.open_at = openDate.toISOString();
      if (closeDate) patchPayload.close_at = closeDate.toISOString();
      await updateAdminExam(newExamId, patchPayload);

      onCreated(newExamId);
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "시험 생성 실패. 입력값을 확인하세요.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const headerTitle =
    step === "select" ? "시험 추가" : step === "template_design" ? "시험 설계 — 템플릿 · 정답 · 배점" : "운영 시험 설정";
  const headerDesc =
    step === "select" ? "템플릿 선택 또는 새 템플릿을 한 화면에서 만든 뒤 운영 시험을 생성합니다." : step === "template_design" ? "선택형/서술형 문항·배점·정답을 입력하고 저장하세요." : "이 차시에 배포할 시험 정보를 입력하세요.";

  return (
    <AdminModal open onClose={onClose} type="action" width={step === "template_design" ? MODAL_WIDTH.xwide : MODAL_WIDTH.wide}>
      <ModalHeader type="action" title={headerTitle} description={headerDesc} />

      <ModalBody>
        <div className="modal-scroll-body modal-scroll-body--compact">
          {error && (
            <div className="modal-hint modal-hint--block" style={{ color: "var(--color-error)", fontWeight: 700 }}>
              {error}
            </div>
          )}

          {/* ---------- select ---------- */}
          {step === "select" && (
            <>
              <div className="modal-form-group">
                <div className="modal-form-row modal-form-row--1-auto" style={{ alignItems: "center" }}>
                  <label className="modal-section-label" style={{ marginBottom: 0 }}>시험 템플릿</label>
                  <button
                    type="button"
                    onClick={() => setStep("template_design")}
                    className="modal-hint"
                    style={{ textDecoration: "underline", cursor: "pointer", fontWeight: 600 }}
                  >
                    + 새 템플릿 만들기
                  </button>
                </div>
                <select
                  className="ds-select"
                  value={templateId ?? ""}
                  onChange={(e) => setTemplateId(e.target.value ? Number(e.target.value) : null)}
                  aria-label="시험 템플릿 선택"
                >
                  <option value="">
                    {isLoading ? "불러오는 중..." : hasAnySelectable ? "선택하세요" : "사용 가능한 템플릿 없음"}
                  </option>
                  {selectableTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} ({t.subject})
                    </option>
                  ))}
                </select>
                {!isLoading && templates.length === 0 && (
                  <p className="modal-hint modal-hint--block">
                    템플릿이 없습니다. <strong>새 템플릿 만들기</strong>로 한 화면에서 만드세요.
                  </p>
                )}
              </div>

              {templateId && (
                <>
                  <div className="modal-form-group">
                    <label className="modal-section-label">시험 제목 (필수)</label>
                    <input
                      className="ds-input"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="예: 3월 모의고사"
                      aria-label="시험 제목"
                    />
                    <label className="modal-section-label">설명 (선택)</label>
                    <textarea
                      className="ds-textarea"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={2}
                      placeholder="설명"
                      aria-label="시험 설명"
                    />
                  </div>
                  <RegularPolicyFields
                    openAt={openAt}
                    setOpenAt={setOpenAt}
                    closeAt={closeAt}
                    setCloseAt={setCloseAt}
                    passScore={passScore}
                    setPassScore={setPassScore}
                    allowRetake={allowRetake}
                    setAllowRetake={setAllowRetake}
                    maxAttempts={maxAttempts}
                    setMaxAttempts={setMaxAttempts}
                  />
                </>
              )}
            </>
          )}

          {/* ---------- template_design (한 화면) ---------- */}
          {step === "template_design" && (
            <>
              <div className="modal-form-group">
                <div className="modal-form-row modal-form-row--3">
                  <div>
                    <label className="modal-section-label">템플릿 제목 (필수)</label>
                    <input
                      className="ds-input"
                      value={templateTitle}
                      onChange={(e) => setTemplateTitle(e.target.value)}
                      placeholder="예: 수학 1차 지필"
                    />
                  </div>
                  <div>
                    <label className="modal-section-label">과목 (선택)</label>
                    <input
                      className="ds-input"
                      value={templateSubject}
                      onChange={(e) => setTemplateSubject(e.target.value)}
                      placeholder="예: 수학"
                    />
                  </div>
                  <div>
                    <label className="modal-section-label">설명 (선택)</label>
                    <input
                      className="ds-input"
                      value={templateDescription}
                      onChange={(e) => setTemplateDescription(e.target.value)}
                      placeholder="설명"
                    />
                  </div>
                </div>
              </div>

              {/* 선택형 | 서술형 좌우 2열 배치 */}
              <div
                className="modal-form-group modal-form-group--neutral"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "var(--space-5)",
                  alignItems: "start",
                }}
              >
                <section style={{ minWidth: 0, maxHeight: "min(60vh, 420px)", overflowY: "auto" }}>
                  <div className="modal-form-row modal-form-row--1-auto" style={{ marginBottom: "var(--space-2)" }}>
                    <span className="modal-section-label" style={{ marginBottom: 0, fontSize: 12 }}>
                      선택형 ({choiceRows.reduce((s, q) => s + (Number(q.score) || 0), 0)}점)
                    </span>
                    <button type="button" onClick={addChoice} className="modal-hint" style={{ textDecoration: "underline", cursor: "pointer", fontWeight: 600, fontSize: 11 }}>
                      + 추가
                    </button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {choiceRows.map((row, index) => (
                      <div
                        key={`c-${index}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "3px 6px",
                          borderRadius: 6,
                          background: (index + 1) % 5 === 1 && index > 0 ? "color-mix(in srgb, var(--color-border-divider) 15%, transparent)" : undefined,
                          borderTop: (index + 1) % 5 === 1 && index > 0 ? "1px solid var(--color-border-divider)" : undefined,
                          paddingTop: (index + 1) % 5 === 1 && index > 0 ? 8 : 3,
                        }}
                      >
                        <span style={{ width: 18, fontSize: 11, fontWeight: 700, color: "var(--color-text-secondary)", flexShrink: 0 }}>
                          {row.number}
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                          {CHOICE_OPTIONS.map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => updateChoice(index, "answer", opt)}
                              className={row.answer === opt ? "exam-omr-bubble exam-omr-bubble--selected" : "exam-omr-bubble"}
                              aria-pressed={row.answer === opt}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                        <input
                          type="number"
                          min={0.5}
                          step={0.5}
                          value={row.score}
                          onChange={(e) => updateChoice(index, "score", e.target.value)}
                          className="ds-input"
                          style={{ width: 44, padding: "2px 4px", fontSize: 11 }}
                          aria-label={`${row.number}번 배점`}
                        />
                        <span style={{ fontSize: 10, color: "var(--color-text-muted)" }}>점</span>
                        {choiceRows.length > 1 && (
                          <button type="button" onClick={() => removeChoice(index)} style={{ fontSize: 10, color: "var(--color-error)", cursor: "pointer", background: "none", border: "none", padding: "0 2px" }}>
                            제외
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </section>

                <section style={{ minWidth: 0, maxHeight: "min(50vh, 360px)", overflowY: "auto" }}>
                  <div className="modal-form-row modal-form-row--1-auto" style={{ marginBottom: "var(--space-3)" }}>
                    <span className="modal-section-label" style={{ marginBottom: 0 }}>
                      서술형 ({subjectiveRows.reduce((s, q) => s + (Number(q.score) || 0), 0)}점)
                    </span>
                    <button type="button" onClick={addSubjective} className="modal-hint" style={{ textDecoration: "underline", cursor: "pointer", fontWeight: 600 }}>
                      + 추가
                    </button>
                  </div>
                  <div className="space-y-2">
                    {subjectiveRows.length === 0 && (
                      <p className="modal-hint modal-hint--block">서술형 문항이 없습니다. 필요 시 + 추가로 넣으세요.</p>
                    )}
                    {subjectiveRows.map((row, index) => (
                      <div
                        key={`s-${index}`}
                        className="modal-option-row"
                        style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--space-2)" }}
                      >
                        <span className="w-8 font-medium text-gray-700">{row.number}</span>
                        <input
                          className="ds-input"
                          type="text"
                          value={row.answer}
                          onChange={(e) => updateSubjective(index, "answer", e.target.value)}
                          style={{ minWidth: 120, flex: 1 }}
                          placeholder="정답 입력"
                          aria-label={`${row.number}번 정답`}
                        />
                        <input
                          type="number"
                          min={0.5}
                          step={0.5}
                          value={row.score}
                          onChange={(e) => updateSubjective(index, "score", e.target.value)}
                          className="ds-input"
                          style={{ width: 64 }}
                          aria-label={`${row.number}번 배점`}
                        />
                        <span className="modal-hint">점</span>
                        <button type="button" onClick={() => removeSubjective(index)} className="modal-hint" style={{ color: "var(--color-error)", cursor: "pointer" }}>
                          제외
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </>
          )}

          {/* ---------- regular_settings ---------- */}
          {step === "regular_settings" && templateId && (
            <>
              <p className="modal-hint modal-hint--block">템플릿이 저장되었습니다. 이 차시에 배포할 운영 시험 정보를 입력하세요.</p>
              <div className="modal-form-group">
                <label className="modal-section-label" style={{ fontWeight: 600 }}>
                  시험 제목 (필수)
                </label>
                <input
                  className="ds-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: 3월 모의고사"
                  aria-label="시험 제목"
                  autoFocus
                />
                {!title.trim() && (
                  <p className="modal-hint" style={{ marginTop: 4, color: "var(--color-text-muted)" }}>
                    위에 시험 제목을 입력한 뒤 아래 &quot;시험 생성&quot; 버튼을 누르세요.
                  </p>
                )}
                <label className="modal-section-label">설명 (선택)</label>
                <textarea
                  className="ds-textarea"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="설명"
                  aria-label="시험 설명"
                />
              </div>
              <RegularPolicyFields
                openAt={openAt}
                setOpenAt={setOpenAt}
                closeAt={closeAt}
                setCloseAt={setCloseAt}
                passScore={passScore}
                setPassScore={setPassScore}
                allowRetake={allowRetake}
                setAllowRetake={setAllowRetake}
                maxAttempts={maxAttempts}
                setMaxAttempts={setMaxAttempts}
              />
            </>
          )}
        </div>
      </ModalBody>

      <ModalFooter
        left={
          <span className="modal-hint">
            {step === "template_design"
              ? `총점 ${totalScore}점`
              : step === "regular_settings"
                ? (!title.trim() ? "시험 제목을 입력하면 생성 버튼이 활성화됩니다." : "")
                : "ESC 로 닫기"}
          </span>
        }
        right={
          step === "select" ? (
            <>
              <Button intent="secondary" onClick={onClose} disabled={submitting}>취소</Button>
              <Button intent="primary" onClick={handleSubmitRegular} disabled={submitting || !templateId}>
                {submitting ? "생성 중…" : "시험 생성"}
              </Button>
            </>
          ) : step === "template_design" ? (
            <>
              <Button intent="secondary" onClick={() => setStep("select")}>취소</Button>
              <Button intent="primary" onClick={handleSaveTemplate} disabled={creatingTemplate || allRows.length === 0}>
                {creatingTemplate ? "저장 중…" : `저장 (총 ${totalScore}점)`}
              </Button>
            </>
          ) : (
            <>
              <Button intent="secondary" onClick={() => { setStep("select"); setTemplateId(null); }}>템플릿 다시 선택</Button>
              <Button intent="primary" onClick={handleSubmitRegular} disabled={submitting || !title.trim()}>
                {submitting ? "생성 중…" : "시험 생성"}
              </Button>
            </>
          )
        }
      />
    </AdminModal>
  );
}

function RegularPolicyFields({
  openAt,
  setOpenAt,
  closeAt,
  setCloseAt,
  passScore,
  setPassScore,
  allowRetake,
  setAllowRetake,
  maxAttempts,
  setMaxAttempts,
}: {
  openAt: string;
  setOpenAt: (s: string) => void;
  closeAt: string;
  setCloseAt: (s: string) => void;
  passScore: number;
  setPassScore: (n: number) => void;
  allowRetake: boolean;
  setAllowRetake: (b: boolean) => void;
  maxAttempts: number;
  setMaxAttempts: (n: number) => void;
}) {
  return (
    <div className="modal-form-group modal-form-group--neutral">
      <span className="modal-section-label">운영 설정</span>
      <div className="modal-form-row modal-form-row--2">
        <div>
          <label className="modal-section-label">공개 일시</label>
          <input
            type="datetime-local"
            value={openAt}
            onChange={(e) => setOpenAt(e.target.value)}
            className="ds-input w-full"
            aria-label="공개 일시"
          />
        </div>
        <div>
          <label className="modal-section-label">마감 일시</label>
          <input
            type="datetime-local"
            value={closeAt}
            onChange={(e) => setCloseAt(e.target.value)}
            className="ds-input w-full"
            aria-label="마감 일시"
          />
        </div>
      </div>
      <div className="modal-form-row modal-form-row--1-auto" style={{ flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <label className="modal-section-label">합격 점수</label>
          <input
            type="number"
            min={0}
            max={100}
            value={passScore}
            onChange={(e) => setPassScore(Number(e.target.value) || 0)}
            className="ds-input"
            style={{ width: 80 }}
            aria-label="합격 점수"
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={allowRetake} onChange={(e) => setAllowRetake(e.target.checked)} aria-label="재응시 허용" />
          <span className="modal-hint" style={{ fontWeight: 600 }}>재응시 허용</span>
        </label>
        {allowRetake && (
          <div>
            <label className="modal-section-label">최대 응시 횟수</label>
            <input
              type="number"
              min={1}
              max={10}
              value={maxAttempts}
              onChange={(e) => setMaxAttempts(Number(e.target.value) || 1)}
              className="ds-input"
              style={{ width: 64 }}
              aria-label="최대 응시 횟수"
            />
          </div>
        )}
      </div>
    </div>
  );
}
