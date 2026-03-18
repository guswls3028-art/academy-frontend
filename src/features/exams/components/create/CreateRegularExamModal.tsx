// PATH: src/features/exams/components/create/CreateRegularExamModal.tsx
// ------------------------------------------------------------
// 시험 생성 모달 — 신규: 일괄 생성 (제목/만점/커트라인 다중 행)
//                     불러오기: 기존 템플릿 import (기존 로직 유지)
// 대상자 자동 등록
// ------------------------------------------------------------

import { useEffect, useMemo, useState, useCallback, type CSSProperties } from "react";
import api from "@/shared/api/axios";
import { AdminModal, ModalHeader, ModalBody, ModalFooter, MODAL_WIDTH } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { SessionBlockView } from "@/shared/ui/session-block";
import { fetchTemplatesWithUsage, type TemplateWithUsage } from "@/features/exams/api/templatesWithUsage";
import { updateAdminExam } from "@/features/exams/api/adminExam";
import { fetchSessionEnrollments } from "@/features/exams/api/sessionEnrollments";
import { updateExamEnrollmentRows } from "@/features/exams/api/examEnrollments";
import { feedback } from "@/shared/ui/feedback/feedback";

type Props = {
  open: boolean;
  onClose: () => void;
  sessionId: number;
  lectureId?: number;
  onCreated: (examId: number) => void;
};

type Stage = "choose" | "new" | "import";

type BulkRow = {
  id: number;
  title: string;
  maxScore: string;
  passScore: string;
};

let rowIdCounter = 0;
function makeRow(): BulkRow {
  return { id: ++rowIdCounter, title: "", maxScore: "100", passScore: "0" };
}

export default function CreateRegularExamModal({
  open,
  onClose,
  sessionId,
  onCreated,
}: Props) {
  const [stage, setStage] = useState<Stage>("choose");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // bulk rows (new stage)
  const [rows, setRows] = useState<BulkRow[]>(() => [makeRow()]);

  // import stage
  const [title, setTitle] = useState("");
  const [templates, setTemplates] = useState<TemplateWithUsage[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [keyword, setKeyword] = useState("");

  useEffect(() => {
    if (!open) return;
    setStage("choose");
    setError(null);
    setSubmitting(false);
    setRows([makeRow()]);
    setTitle("");
    setTemplates([]);
    setTemplatesLoading(false);
    setSelectedTemplateId(null);
    setKeyword("");
  }, [open]);

  useEffect(() => {
    if (!open || stage !== "import") return;

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

    return () => { cancelled = true; };
  }, [open, stage]);

  const autoEnroll = useCallback(async (examId: number) => {
    try {
      const enrollments = await fetchSessionEnrollments(sessionId);
      const ids = enrollments.map((e) => e.enrollment);
      if (ids.length > 0) {
        await updateExamEnrollmentRows({ examId, sessionId, enrollment_ids: ids });
      }
    } catch {
      feedback.warning("학생 자동 등록에 실패했습니다. 수동으로 등록해 주세요.");
    }
  }, [sessionId]);

  // ── Bulk row helpers ──
  const addRow = () => setRows((prev) => [...prev, makeRow()]);

  const removeRow = (id: number) =>
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)));

  const updateRow = (id: number, field: keyof Omit<BulkRow, "id">, value: string) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));

  // ── Bulk submit (new stage) ──
  const handleBulkSubmit = async () => {
    if (!sessionId) {
      setError("세션 정보가 없습니다.");
      return;
    }

    const validRows = rows.filter((r) => r.title.trim());
    if (validRows.length === 0) {
      setError("시험 제목을 하나 이상 입력하세요.");
      return;
    }

    setError(null);
    setSubmitting(true);

    let successCount = 0;
    const failedTitles: string[] = [];

    for (const row of validRows) {
      try {
        const res = await api.post("/exams/", {
          title: row.title.trim(),
          description: "",
          exam_type: "regular",
          session_id: sessionId,
        });
        const newExamId = Number(res.data?.id);
        if (!newExamId) throw new Error("생성 후 ID를 받지 못했습니다.");

        // Save max_score, pass_score, answer_visibility
        const ms = Number(row.maxScore);
        const ps = Number(row.passScore);
        await updateAdminExam(newExamId, {
          max_score: Number.isFinite(ms) && ms > 0 ? ms : 100,
          pass_score: Number.isFinite(ps) && ps >= 0 ? ps : 0,
          answer_visibility: "hidden",
        });

        // Auto-enroll students (fire and forget)
        void autoEnroll(newExamId);

        onCreated(newExamId);
        successCount++;
      } catch (e: any) {
        failedTitles.push(row.title.trim());
      }
    }

    setSubmitting(false);

    if (failedTitles.length === 0) {
      feedback.success(`${successCount}개 시험 일괄 생성 완료`);
      onClose();
    } else if (successCount > 0) {
      feedback.warning(
        `${successCount}개 생성 완료, ${failedTitles.length}개 실패: ${failedTitles.join(", ")}`
      );
      onClose();
    } else {
      setError(`시험 생성 실패: ${failedTitles.join(", ")}`);
    }
  };

  // ── Import submit (unchanged logic) ──
  const handleImportSubmit = async () => {
    if (!sessionId) {
      setError("세션 정보가 없습니다.");
      return;
    }
    if (!selectedTemplateId) {
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
        template_exam_id: selectedTemplateId,
      });
      const newExamId = Number(res.data?.id);
      if (!newExamId) throw new Error("생성 후 ID를 받지 못했습니다.");

      void autoEnroll(newExamId);
      onCreated(newExamId);
      feedback.success(`"${title.trim()}" 시험 생성 완료`);
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? "시험 생성 실패. 입력값을 확인하세요.");
    } finally {
      setSubmitting(false);
    }
  };

  const importDisabled =
    submitting || !(sessionId > 0) || !title.trim() || !selectedTemplateId;

  const bulkHasAnyTitle = rows.some((r) => r.title.trim());

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
        <span>{stage === "new" ? "일괄 생성" : "불러오기"}</span>
      </div>
    );

  return (
    <AdminModal
      open
      onClose={onClose}
      type="action"
      width={MODAL_WIDTH.default}
      onEnterConfirm={
        stage === "new" && bulkHasAnyTitle && !submitting
          ? handleBulkSubmit
          : stage === "import" && !importDisabled
          ? handleImportSubmit
          : undefined
      }
    >
      <ModalHeader
        type="action"
        title={headerTitle}
        description={
          stage === "choose"
            ? "신규 시험을 만들거나, 기존 템플릿을 불러와 이 차시에 적용할 수 있습니다. 대상자는 자동 등록됩니다."
            : stage === "new"
            ? "여러 시험을 한번에 생성할 수 있습니다. 행을 추가한 뒤 일괄 생성하세요."
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
                  desc="여러 시험을 한번에 생성합니다."
                  onClick={() => {
                    setError(null);
                    setRows([makeRow()]);
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
            </div>
          )}

          {/* ── Stage: new (bulk rows) ── */}
          {stage === "new" && (
            <div className="modal-form-group">
              {/* Header labels */}
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 text-xs font-semibold text-[var(--color-text-muted)]">제목</div>
                <div className="text-xs font-semibold text-[var(--color-text-muted)]" style={{ width: 80 }}>만점</div>
                <div className="text-xs font-semibold text-[var(--color-text-muted)]" style={{ width: 80 }}>커트라인</div>
                <div style={{ width: 32 }} />
              </div>

              {/* Rows */}
              <div className="space-y-2">
                {rows.map((row, idx) => (
                  <div key={row.id} className="flex items-center gap-2">
                    <input
                      className="ds-input flex-1"
                      value={row.title}
                      onChange={(e) => updateRow(row.id, "title", e.target.value)}
                      placeholder={`시험 ${idx + 1}`}
                      autoFocus={idx === 0}
                      aria-label={`시험 ${idx + 1} 제목`}
                    />
                    <input
                      type="number"
                      min={1}
                      className="ds-input"
                      style={{ width: 80 }}
                      value={row.maxScore}
                      onChange={(e) => updateRow(row.id, "maxScore", e.target.value)}
                      placeholder="100"
                      aria-label={`시험 ${idx + 1} 만점`}
                    />
                    <input
                      type="number"
                      min={0}
                      className="ds-input"
                      style={{ width: 80 }}
                      value={row.passScore}
                      onChange={(e) => updateRow(row.id, "passScore", e.target.value)}
                      placeholder="0"
                      aria-label={`시험 ${idx + 1} 커트라인`}
                    />
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      disabled={rows.length <= 1}
                      className="flex items-center justify-center rounded text-[var(--color-text-muted)] hover:text-[var(--color-error)] disabled:opacity-30 disabled:cursor-not-allowed"
                      style={{ width: 32, height: 32, flexShrink: 0 }}
                      aria-label="행 삭제"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              {/* Add row button */}
              <button
                type="button"
                onClick={addRow}
                className="mt-3 w-full rounded border border-dashed border-[var(--color-border-divider)] py-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-brand-primary)] hover:border-[var(--color-brand-primary)] transition-colors"
              >
                + 추가
              </button>

              <div className="mt-3 rounded border border-[var(--color-border-divider)] bg-[color-mix(in_srgb,var(--color-brand-primary)_4%,var(--color-bg-surface))] p-3">
                <div className="text-xs text-[var(--color-text-muted)]">
                  대상자 자동 등록됨 (이 차시의 모든 수강생)
                </div>
              </div>
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

          {/* ── Import: title input ── */}
          {stage === "import" && (
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
              {selectedTemplate && (
                <p className="modal-hint modal-hint--block">
                  템플릿: {selectedTemplate.title}
                </p>
              )}
            </div>
          )}
        </div>
      </ModalBody>

      <ModalFooter
        right={
          <>
            <Button intent="secondary" size="xl" onClick={onClose} disabled={submitting}>
              취소
            </Button>
            {stage === "new" && (
              <Button
                intent="primary"
                size="xl"
                onClick={handleBulkSubmit}
                disabled={submitting || !bulkHasAnyTitle}
              >
                {submitting ? "생성 중…" : `일괄 생성${rows.filter((r) => r.title.trim()).length > 1 ? ` (${rows.filter((r) => r.title.trim()).length}개)` : ""}`}
              </Button>
            )}
            {stage === "import" && (
              <Button
                intent="primary"
                size="xl"
                onClick={handleImportSubmit}
                disabled={importDisabled}
              >
                {submitting ? "생성 중…" : "생성"}
              </Button>
            )}
          </>
        }
      />
    </AdminModal>
  );
}
