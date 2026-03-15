// PATH: src/features/exams/components/create/CreateRegularExamModal.tsx
// ------------------------------------------------------------
// 시험 생성 모달 — 제목 → 생성 → 설정(만점/커트라인) → 연속 생성 가능
// 대상자 자동 등록, 여러 시험 연속 생성 지원
// ------------------------------------------------------------

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import api from "@/shared/api/axios";
import { AdminModal, ModalHeader, ModalBody, ModalFooter, MODAL_WIDTH } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { SessionBlockView } from "@/shared/ui/session-block";
import { fetchTemplatesWithUsage, type TemplateWithUsage } from "@/features/exams/api/templatesWithUsage";
import { updateAdminExam } from "@/features/exams/api/adminExam";
import { fetchSessionEnrollments } from "@/features/exams/api/sessionEnrollments";
import { updateExamEnrollmentRows } from "@/features/exams/api/examEnrollments";
import { feedback } from "@/shared/ui/feedback/feedback";
import type { AnswerVisibility } from "@/features/exams/types";

type Props = {
  open: boolean;
  onClose: () => void;
  sessionId: number;
  lectureId?: number;
  onCreated: (examId: number) => void;
};

type Stage = "choose" | "new" | "import" | "setup";

export default function CreateRegularExamModal({
  open,
  onClose,
  sessionId,
  onCreated,
}: Props) {
  const [stage, setStage] = useState<Stage>("choose");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [templates, setTemplates] = useState<TemplateWithUsage[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [keyword, setKeyword] = useState("");

  // post-creation setup
  const [createdExamId, setCreatedExamId] = useState<number | null>(null);
  const [maxScore, setMaxScore] = useState("100");
  const [passScore, setPassScore] = useState("0");
  const [savingSetup, setSavingSetup] = useState(false);
  const [answerVisibility, setAnswerVisibility] = useState<AnswerVisibility>("hidden");

  // sequential creation tracking
  const [createdCount, setCreatedCount] = useState(0);
  const [lastStage, setLastStage] = useState<"new" | "import">("new");

  useEffect(() => {
    if (!open) return;
    setStage("choose");
    setTitle("");
    setError(null);
    setSubmitting(false);
    setTemplates([]);
    setTemplatesLoading(false);
    setSelectedTemplateId(null);
    setKeyword("");
    setCreatedExamId(null);
    setMaxScore("100");
    setPassScore("0");
    setSavingSetup(false);
    setAnswerVisibility("hidden");
    setCreatedCount(0);
    setLastStage("new");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (stage !== "import") return;

    let cancelled = false;
    setTemplatesLoading(true);
    setError(null);
    fetchTemplatesWithUsage()
      .then((items) => {
        if (cancelled) return;
        setTemplates(items ?? []);
      })
      .catch((e: any) => {
        if (cancelled) return;
        setError(e?.response?.data?.detail ?? e?.message ?? "템플릿 목록을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (cancelled) return;
        setTemplatesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, stage]);

  const autoEnroll = async (examId: number) => {
    try {
      const enrollments = await fetchSessionEnrollments(sessionId);
      const ids = enrollments.map((e) => e.enrollment);
      if (ids.length > 0) {
        await updateExamEnrollmentRows({ examId, sessionId, enrollment_ids: ids });
      }
    } catch {
      feedback.warning("학생 자동 등록에 실패했습니다. 수동으로 등록해 주세요.");
    }
  };

  const handleSubmit = async () => {
    if (!sessionId) {
      setError("세션 정보가 없습니다.");
      return;
    }
    if (stage === "choose") {
      setError("생성 방식을 선택하세요.");
      return;
    }
    if (stage === "import" && !selectedTemplateId) {
      setError("불러올 템플릿을 선택하세요.");
      return;
    }
    if (!title.trim()) {
      setError("시험 제목을 입력하세요.");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const res = await api.post("/exams/", {
        title: title.trim(),
        description: "",
        exam_type: "regular",
        session_id: sessionId,
        ...(stage === "import" ? { template_exam_id: selectedTemplateId } : {}),
      });
      const newExamId = Number(res.data?.id);
      if (!newExamId) throw new Error("생성 후 ID를 받지 못했습니다.");

      // Auto-enroll students
      void autoEnroll(newExamId);

      setCreatedExamId(newExamId);
      setLastStage(stage === "import" ? "import" : "new");
      setCreatedCount((c) => c + 1);
      onCreated(newExamId);
      setStage("setup");
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? "시험 생성 실패. 입력값을 확인하세요.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveSetup = async () => {
    if (!createdExamId) return;
    setSavingSetup(true);
    try {
      const ms = Number(maxScore);
      const ps = Number(passScore);
      await updateAdminExam(createdExamId, {
        max_score: Number.isFinite(ms) && ms > 0 ? ms : 100,
        pass_score: Number.isFinite(ps) && ps >= 0 ? ps : 0,
        answer_visibility: answerVisibility,
      });
      feedback.success(`"${title}" 만점·커트라인 저장 완료`);
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? "설정 저장 실패");
    } finally {
      setSavingSetup(false);
    }
  };

  const handleSaveAndContinue = async () => {
    if (!createdExamId) return;
    setSavingSetup(true);
    try {
      const ms = Number(maxScore);
      const ps = Number(passScore);
      await updateAdminExam(createdExamId, {
        max_score: Number.isFinite(ms) && ms > 0 ? ms : 100,
        pass_score: Number.isFinite(ps) && ps >= 0 ? ps : 0,
        answer_visibility: answerVisibility,
      });
      feedback.success(`"${title}" 저장 완료 (${createdCount}번째)`);
      // Reset for next creation
      setTitle("");
      setSelectedTemplateId(null);
      setCreatedExamId(null);
      setMaxScore("100");
      setPassScore("0");
      setAnswerVisibility("hidden");
      setError(null);
      setStage(lastStage);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? "설정 저장 실패");
    } finally {
      setSavingSetup(false);
    }
  };

  const disabled =
    submitting ||
    !(sessionId > 0) ||
    stage === "choose" ||
    !title.trim() ||
    (stage === "import" && !selectedTemplateId);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? null;

  const filteredTemplates = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    const base = [...templates];
    base.sort((a, b) => {
      const ad = a.last_used_date ?? "";
      const bd = b.last_used_date ?? "";
      if (ad !== bd) return bd.localeCompare(ad);
      return (a.title ?? "").localeCompare(b.title ?? "");
    });
    if (!k) return base;
    return base.filter((t) => {
      const tTitle = (t.title ?? "").toLowerCase();
      const tSub = (t.subject ?? "").toLowerCase();
      return tTitle.includes(k) || tSub.includes(k);
    });
  }, [templates, keyword]);

  if (!open) return null;

  const headerTitle =
    stage === "choose" ? (
      "시험 생성"
    ) : stage === "setup" ? (
      <span>
        시험 설정
        {createdCount > 1 && (
          <span className="ml-2 text-xs font-normal text-[var(--color-text-muted)]">
            ({createdCount}번째)
          </span>
        )}
      </span>
    ) : (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setError(null);
            setSubmitting(false);
            setStage("choose");
          }}
          className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          aria-label="뒤로"
        >
          ←
        </button>
        <span>
          {stage === "new" ? "신규시험" : "불러오기"}
          {createdCount > 0 && (
            <span className="ml-2 text-xs font-normal text-[var(--color-text-muted)]">
              ({createdCount}개 생성됨)
            </span>
          )}
        </span>
      </div>
    );

  return (
    <AdminModal
      open
      onClose={onClose}
      type="action"
      width={MODAL_WIDTH.default}
      onEnterConfirm={
        stage === "setup"
          ? handleSaveSetup
          : stage !== "choose" && !disabled
          ? handleSubmit
          : undefined
      }
    >
      <ModalHeader
        type="action"
        title={headerTitle}
        description={
          stage === "choose"
            ? "신규 시험을 만들거나, 기존 템플릿을 불러와 이 차시에 적용할 수 있습니다. 대상자는 자동 등록됩니다."
            : stage === "setup"
            ? `"${title}" 시험이 생성되었습니다. 만점·커트라인을 설정하세요.`
            : undefined
        }
      />

      <ModalBody>
        <div className="modal-scroll-body modal-scroll-body--compact">
          {error && (
            <div className="modal-hint modal-hint--block" style={{ color: "var(--color-error)", fontWeight: 700 }}>
              {error}
            </div>
          )}

          {/* ── Stage: choose ── */}
          {stage === "choose" && (
            <div className="modal-form-group">
              <div className="modal-section-label mb-3">생성 방식</div>
              <div className="grid grid-cols-2 gap-5">
                <SessionBlockView
                  variant="n1"
                  compact={false}
                  selected={false}
                  showCheck
                  title="신규시험"
                  desc="이 차시에 새 시험을 생성합니다."
                  onClick={() => {
                    setError(null);
                    setTitle("");
                    setSelectedTemplateId(null);
                    setStage("new");
                  }}
                />
                <SessionBlockView
                  variant="supplement"
                  compact={false}
                  selected={false}
                  showCheck
                  title="불러오기"
                  desc="다른 강의의 시험을 불러옵니다."
                  onClick={() => {
                    setError(null);
                    setTitle("");
                    setSelectedTemplateId(null);
                    setKeyword("");
                    setStage("import");
                  }}
                />
              </div>
              {createdCount > 0 && (
                <p className="mt-3 text-sm text-[var(--color-brand-primary)] font-semibold">
                  {createdCount}개 시험이 생성되었습니다.
                </p>
              )}
            </div>
          )}

          {/* ── Stage: import ── */}
          {stage === "import" && (
            <div className="modal-form-group">
              <label className="modal-section-label">템플릿 선택</label>
              <div className="rounded border border-[var(--border-divider)] bg-[var(--bg-surface)] p-3 space-y-2">
                <input
                  className="ds-input"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="제목/과목 검색"
                  aria-label="템플릿 검색"
                />
                {templatesLoading && (
                  <div className="text-sm text-[var(--text-muted)]">불러오는 중…</div>
                )}
                {!templatesLoading && filteredTemplates.length === 0 && (
                  <div className="text-sm text-[var(--text-muted)]">사용 가능한 템플릿이 없습니다.</div>
                )}
                {!templatesLoading && filteredTemplates.length > 0 && (
                  <div className="grid gap-2" style={{ maxHeight: 240, overflowY: "auto" }}>
                    {filteredTemplates.map((t) => {
                      const active = t.id === selectedTemplateId;
                      const lectures = [...(t.used_lectures ?? [])].sort((a, b) =>
                        String(b.last_used_date ?? "").localeCompare(String(a.last_used_date ?? ""))
                      );
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setSelectedTemplateId(t.id);
                            setTitle(t.title);
                          }}
                          className={`w-full text-left rounded border px-3 py-2 transition-colors ${
                            active
                              ? "border-[var(--color-brand-primary)] bg-[var(--state-selected-bg)]"
                              : "border-[var(--border-divider)] hover:bg-[var(--bg-surface-soft)]"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-[var(--text-primary)] truncate">
                                {t.title}
                              </div>
                              <div className="mt-0.5 text-xs text-[var(--text-muted)]">
                                {t.subject ? `과목: ${t.subject}` : "과목: -"}
                              </div>
                            </div>
                          </div>
                          {lectures.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {lectures.slice(0, 4).map((lec) => (
                                <span
                                  key={lec.lecture_id}
                                  className="ds-badge"
                                  style={
                                    lec.color
                                      ? ({
                                          ["--badge-bg" as any]: `color-mix(in srgb, ${lec.color} 18%, var(--bg-surface-soft))`,
                                          ["--badge-text" as any]: "var(--text-primary)",
                                        } as CSSProperties)
                                      : undefined
                                  }
                                >
                                  {(lec.chip_label ? `${lec.chip_label} ` : "") + lec.lecture_title}
                                </span>
                              ))}
                              {lectures.length > 4 && (
                                <span className="ds-badge">+{lectures.length - 4}</span>
                              )}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Stage: new / import → title input ── */}
          {(stage === "new" || stage === "import") && (
            <div className="modal-form-group">
              <label className="modal-section-label">제목 (필수)</label>
              <input
                className="ds-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예) 3월 모의고사"
                autoFocus
                aria-label="시험 제목"
              />
              {stage === "import" && selectedTemplate && (
                <p className="modal-hint modal-hint--block">
                  템플릿: {selectedTemplate.title}
                </p>
              )}
            </div>
          )}

          {/* ── Stage: setup (post-creation) ── */}
          {stage === "setup" && (
            <div className="space-y-5">
              <div className="modal-form-group">
                <div className="modal-section-label mb-2">만점 / 커트라인</div>
                <div className="flex items-center gap-4">
                  <div>
                    <div className="mb-1 text-xs text-[var(--color-text-muted)]">만점</div>
                    <input
                      type="number"
                      min={1}
                      className="ds-input"
                      style={{ width: 120 }}
                      value={maxScore}
                      onChange={(e) => setMaxScore(e.target.value)}
                      placeholder="100"
                      autoFocus
                    />
                  </div>
                  <div>
                    <div className="mb-1 text-xs text-[var(--color-text-muted)]">커트라인</div>
                    <input
                      type="number"
                      min={0}
                      className="ds-input"
                      style={{ width: 120 }}
                      value={passScore}
                      onChange={(e) => setPassScore(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

              <div className="modal-form-group">
                <div className="modal-section-label mb-2">정답 공개</div>
                <select
                  className="ds-input"
                  value={answerVisibility}
                  onChange={(e) => setAnswerVisibility(e.target.value as AnswerVisibility)}
                  style={{ width: "100%" }}
                >
                  <option value="hidden">비공개</option>
                  <option value="after_closed">마감 후 공개</option>
                  <option value="always">항상 공개</option>
                </select>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  학생이 결과 화면에서 정답을 볼 수 있는 조건을 설정합니다.
                </p>
              </div>

              <div className="rounded border border-[var(--color-border-divider)] bg-[color-mix(in_srgb,var(--color-brand-primary)_4%,var(--color-bg-surface))] p-3">
                <div className="text-xs text-[var(--color-text-muted)]">
                  대상자 자동 등록됨 (이 차시의 모든 수강생)
                </div>
              </div>
            </div>
          )}
        </div>
      </ModalBody>

      <ModalFooter
        right={
          <>
            <Button intent="secondary" size="xl" onClick={onClose} disabled={submitting || savingSetup}>
              {stage === "setup" ? (createdCount > 0 ? "닫기" : "건너뛰기") : "취소"}
            </Button>
            {stage === "setup" ? (
              <>
                <Button
                  intent="secondary"
                  size="xl"
                  onClick={handleSaveAndContinue}
                  disabled={savingSetup}
                >
                  저장 후 계속 추가
                </Button>
                <Button intent="primary" size="xl" onClick={handleSaveSetup} disabled={savingSetup}>
                  {savingSetup ? "저장 중…" : "완료"}
                </Button>
              </>
            ) : stage !== "choose" ? (
              <Button intent="primary" size="xl" onClick={handleSubmit} disabled={disabled}>
                {submitting ? "생성 중…" : "생성"}
              </Button>
            ) : null}
          </>
        }
      />
    </AdminModal>
  );
}
