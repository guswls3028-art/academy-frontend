// PATH: src/features/exams/components/create/CreateRegularExamModal.tsx
// ------------------------------------------------------------
// 시험 생성 모달 — 과제와 동일: 제목만 입력 후 생성. 템플릿·세부 설정은 시험 설정에서.
// ------------------------------------------------------------

import { useEffect, useState } from "react";
import api from "@/shared/api/axios";
import { AdminModal, ModalHeader, ModalBody, ModalFooter, MODAL_WIDTH } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { SessionBlockView } from "@/shared/ui/session-block";
import { fetchTemplatesWithUsage, type TemplateWithUsage } from "@/features/exams/api/templatesWithUsage";

type Props = {
  open: boolean;
  onClose: () => void;
  sessionId: number;
  lectureId?: number;
  onCreated: (examId: number) => void;
};

type Stage = "choose" | "new" | "import";

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

  useEffect(() => {
    if (!open) return;
    setStage("choose");
    setTitle("");
    setError(null);
    setSubmitting(false);
    setTemplates([]);
    setTemplatesLoading(false);
    setSelectedTemplateId(null);
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
      onCreated(newExamId);
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? "시험 생성 실패. 입력값을 확인하세요.");
    } finally {
      setSubmitting(false);
    }
  };

  const disabled =
    submitting ||
    !(sessionId > 0) ||
    stage === "choose" ||
    !title.trim() ||
    (stage === "import" && !selectedTemplateId);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter" && stage !== "choose" && !disabled) {
        e.preventDefault();
        handleSubmit();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, disabled, stage]);

  if (!open) return null;

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? null;

  const headerTitle =
    stage === "choose" ? (
      "시험 생성"
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
        <span>{stage === "new" ? "신규시험" : "불러오기"}</span>
      </div>
    );

  return (
    <AdminModal
      open
      onClose={onClose}
      type="action"
      width={MODAL_WIDTH.default}
      onEnterConfirm={stage !== "choose" && !disabled ? handleSubmit : undefined}
    >
      <ModalHeader
        type="action"
        title={headerTitle}
        description={
          stage === "choose"
            ? "신규시험을 만들거나, 기존 템플릿을 불러와 이 차시에 적용할 수 있습니다."
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
                  desc="템플릿을 선택해 이 차시에 적용합니다."
                  onClick={() => {
                    setError(null);
                    setTitle("");
                    setSelectedTemplateId(null);
                    setStage("import");
                  }}
                />
              </div>
            </div>
          )}

          {stage === "import" && (
            <div className="modal-form-group">
              <label className="modal-section-label">템플릿 선택</label>

              <div className="rounded border border-[var(--border-divider)] bg-[var(--bg-surface)] p-3 space-y-2">
                {templatesLoading && (
                  <div className="text-sm text-[var(--text-muted)]">불러오는 중…</div>
                )}
                {!templatesLoading && templates.length === 0 && (
                  <div className="text-sm text-[var(--text-muted)]">사용 가능한 템플릿이 없습니다.</div>
                )}

                {!templatesLoading && templates.length > 0 && (
                  <div className="grid gap-2">
                    {templates.map((t) => {
                      const active = t.id === selectedTemplateId;
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
                            <div className="shrink-0 text-xs text-[var(--text-muted)]">
                              template #{t.id}
                            </div>
                          </div>

                          {t.used_lectures?.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {t.used_lectures.slice(0, 6).map((lec) => (
                                <span key={lec.lecture_id} className="ds-badge">
                                  {lec.lecture_title}
                                </span>
                              ))}
                              {t.used_lectures.length > 6 && (
                                <span className="ds-badge">
                                  +{t.used_lectures.length - 6}
                                </span>
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

          {stage !== "choose" && (
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
                  템플릿: {selectedTemplate.title} (#{selectedTemplate.id})
                </p>
              )}
            </div>
          )}
        </div>
      </ModalBody>

      <ModalFooter
        right={
          <>
            <Button intent="secondary" onClick={onClose} disabled={submitting}>
              취소
            </Button>
            {stage !== "choose" && (
              <Button intent="primary" onClick={handleSubmit} disabled={disabled}>
                {submitting ? "생성 중…" : "생성"}
              </Button>
            )}
          </>
        }
      />
    </AdminModal>
  );
}
