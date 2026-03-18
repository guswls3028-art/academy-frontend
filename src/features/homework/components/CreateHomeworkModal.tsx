// PATH: src/features/homework/components/CreateHomeworkModal.tsx
// ------------------------------------------------------------
// 과제 생성 모달 — 일괄 생성(bulk) 지원
// 신규: 행 기반 폼으로 여러 과제를 한 번에 생성
// 불러오기: 기존 템플릿 import 유지
// 대상자 자동 등록
// ------------------------------------------------------------

import { useEffect, useState, useMemo, useCallback } from "react";
import api from "@/shared/api/axios";
import { AdminModal, ModalHeader, ModalBody, ModalFooter, MODAL_WIDTH } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { SessionBlockView } from "@/shared/ui/session-block";
import { fetchHomeworkTemplatesWithUsage, type HomeworkTemplateWithUsage } from "../api/adminHomework";
import { fetchHomeworkPolicyBySession, patchHomeworkPolicy } from "../api/homeworkPolicy";
import { fetchSessionEnrollments } from "@/features/exams/api/sessionEnrollments";
import { putHomeworkAssignments } from "../api/homeworkAssignments";
import { feedback } from "@/shared/ui/feedback/feedback";

type Props = {
  open: boolean;
  onClose: () => void;
  sessionId: number;
  onCreated: (newId: number) => void;
};

type Stage = "choose" | "new" | "import";

type BulkRow = {
  key: number;
  title: string;
  maxScore: string;
  cutline: string;
};

let rowKeyCounter = 0;
function makeRow(): BulkRow {
  return { key: ++rowKeyCounter, title: "", maxScore: "100", cutline: "80" };
}

export default function CreateHomeworkModal({
  open,
  onClose,
  sessionId,
  onCreated,
}: Props) {
  const [stage, setStage] = useState<Stage>("choose");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // bulk rows for "new" stage
  const [rows, setRows] = useState<BulkRow[]>(() => [makeRow()]);

  // import stage state
  const [title, setTitle] = useState("");
  const [templates, setTemplates] = useState<HomeworkTemplateWithUsage[]>([]);
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

  // Load templates for import stage
  useEffect(() => {
    if (!open || stage !== "import") return;
    let cancelled = false;
    setTemplatesLoading(true);
    setError(null);
    fetchHomeworkTemplatesWithUsage()
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

  const autoEnroll = useCallback(async (homeworkId: number) => {
    try {
      const enrollments = await fetchSessionEnrollments(sessionId);
      const ids = enrollments.map((e) => e.enrollment);
      if (ids.length > 0) {
        await putHomeworkAssignments({ homeworkId, enrollment_ids: ids });
      }
    } catch {
      feedback.warning("학생 자동 등록에 실패했습니다. 수동으로 등록해 주세요.");
    }
  }, [sessionId]);

  // ── Bulk row helpers ──
  const addRow = () => setRows((prev) => [...prev, makeRow()]);

  const removeRow = (key: number) =>
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.key !== key)));

  const updateRow = (key: number, field: keyof Omit<BulkRow, "key">, value: string) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));

  // ── Bulk submit ──
  const handleBulkSubmit = async () => {
    if (!sessionId) {
      setError("세션 정보가 없습니다.");
      return;
    }
    const validRows = rows.filter((r) => r.title.trim());
    if (validRows.length === 0) {
      setError("과제 제목을 하나 이상 입력하세요.");
      return;
    }
    setError(null);
    setSubmitting(true);

    const created: { id: number; title: string }[] = [];
    const failed: string[] = [];

    // Apply cutline from the first row
    const firstCutline = Number(validRows[0].cutline);
    let policyPatched = false;

    try {
      const policy = await fetchHomeworkPolicyBySession(sessionId);
      if (policy?.id) {
        await patchHomeworkPolicy(policy.id, {
          cutline_mode: "PERCENT",
          cutline_value: Number.isFinite(firstCutline) && firstCutline >= 0 ? firstCutline : 80,
        });
        policyPatched = true;
      }
    } catch {
      // best-effort policy patch
    }

    for (const row of validRows) {
      try {
        const res = await api.post("/homeworks/", {
          session_id: sessionId,
          title: row.title.trim(),
        });
        const newId = Number(res.data?.id ?? res.data?.homework_id ?? res.data?.pk);
        if (!Number.isFinite(newId) || newId <= 0) throw new Error("생성 후 ID를 받지 못했습니다.");

        // Save max_score
        const ms = Number(row.maxScore);
        if (Number.isFinite(ms) && ms > 0) {
          try {
            await api.patch(`/homeworks/${newId}/`, {
              meta: { default_max_score: ms },
            });
          } catch {
            // best-effort
          }
        }

        // Auto-enroll
        void autoEnroll(newId);

        created.push({ id: newId, title: row.title.trim() });
        onCreated(newId);
      } catch (e: any) {
        failed.push(row.title.trim());
      }
    }

    setSubmitting(false);

    if (created.length > 0) {
      const msg = `${created.length}개 과제 생성 완료` +
        (policyPatched ? ` (커트라인 ${firstCutline}%)` : "") +
        (failed.length > 0 ? ` · ${failed.length}개 실패` : "");
      feedback.success(msg);
    }
    if (failed.length > 0 && created.length === 0) {
      setError(`모든 과제 생성에 실패했습니다: ${failed.join(", ")}`);
      return;
    }
    onClose();
  };

  // ── Import submit (single homework from template) ──
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
      setError("과제 제목을 입력하세요.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.post("/homeworks/", {
        session_id: sessionId,
        title: title.trim(),
        template_homework_id: selectedTemplateId,
      });
      const newId = Number(res.data?.id ?? res.data?.homework_id ?? res.data?.pk);
      if (!Number.isFinite(newId) || newId <= 0) throw new Error("생성 후 ID를 받지 못했습니다.");

      void autoEnroll(newId);
      onCreated(newId);
      feedback.success(`"${title.trim()}" 과제 생성 완료`);
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? "과제 생성 실패.");
    } finally {
      setSubmitting(false);
    }
  };

  const bulkDisabled = submitting || rows.every((r) => !r.title.trim());
  const importDisabled = submitting || !title.trim() || !selectedTemplateId;

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? null;
  const filteredTemplates = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    const base = [...templates].sort((a, b) =>
      (b.last_used_date ?? "").localeCompare(a.last_used_date ?? "")
    );
    if (!k) return base;
    return base.filter((t) => (t.title ?? "").toLowerCase().includes(k));
  }, [templates, keyword]);

  if (!open) return null;

  const headerTitle =
    stage === "choose" ? (
      "과제 생성"
    ) : (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => { setError(null); setStage("choose"); }}
          className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          aria-label="뒤로"
        >
          ←
        </button>
        <span>{stage === "new" ? "일괄 과제 생성" : "불러오기"}</span>
      </div>
    );

  return (
    <AdminModal
      open
      onClose={onClose}
      type="action"
      width={MODAL_WIDTH.default}
      onEnterConfirm={
        stage === "new"
          ? (!bulkDisabled ? handleBulkSubmit : undefined)
          : stage === "import"
          ? (!importDisabled ? handleImportSubmit : undefined)
          : undefined
      }
    >
      <ModalHeader
        type="action"
        title={headerTitle}
        description={
          stage === "choose"
            ? "신규 과제를 만들거나, 기존 템플릿을 불러와 이 차시에 적용할 수 있습니다. 대상자는 자동 등록됩니다."
            : stage === "new"
            ? "여러 과제를 한 번에 생성할 수 있습니다. 행을 추가하고 일괄 생성하세요."
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
                  title="신규 과제"
                  desc="이 차시에 새 과제를 생성합니다."
                  onClick={() => { setError(null); setRows([makeRow()]); setStage("new"); }}
                />
                <SessionBlockView
                  variant="supplement"
                  compact={false}
                  selected={false}
                  showCheck
                  title="불러오기"
                  desc="다른 강의의 과제 템플릿을 불러옵니다."
                  onClick={() => { setError(null); setKeyword(""); setSelectedTemplateId(null); setTitle(""); setStage("import"); }}
                />
              </div>
            </div>
          )}

          {/* ── Stage: new (bulk form) ── */}
          {stage === "new" && (
            <div className="modal-form-group">
              <table className="ds-table w-full" style={{ tableLayout: "fixed" }}>
                <colgroup>
                  <col />
                  <col style={{ width: 90 }} />
                  <col style={{ width: 100 }} />
                  <col style={{ width: 40 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th className="text-left text-xs font-semibold" style={{ padding: "6px 8px" }}>제목</th>
                    <th className="text-left text-xs font-semibold" style={{ padding: "6px 8px" }}>만점</th>
                    <th className="text-left text-xs font-semibold" style={{ padding: "6px 8px" }}>커트라인 (%)</th>
                    <th style={{ padding: "6px 8px" }} />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={row.key}>
                      <td style={{ padding: "4px 8px" }}>
                        <input
                          className="ds-input w-full"
                          value={row.title}
                          onChange={(e) => updateRow(row.key, "title", e.target.value)}
                          placeholder={`${idx + 1}주차 과제`}
                          autoFocus={idx === 0}
                          aria-label={`과제 ${idx + 1} 제목`}
                        />
                      </td>
                      <td style={{ padding: "4px 8px" }}>
                        <input
                          type="number"
                          min={1}
                          className="ds-input w-full"
                          value={row.maxScore}
                          onChange={(e) => updateRow(row.key, "maxScore", e.target.value)}
                          aria-label={`과제 ${idx + 1} 만점`}
                        />
                      </td>
                      <td style={{ padding: "4px 8px" }}>
                        <input
                          type="number"
                          min={0}
                          className="ds-input w-full"
                          value={row.cutline}
                          onChange={(e) => updateRow(row.key, "cutline", e.target.value)}
                          aria-label={`과제 ${idx + 1} 커트라인`}
                        />
                      </td>
                      <td style={{ padding: "4px 8px", textAlign: "center" }}>
                        <button
                          type="button"
                          onClick={() => removeRow(row.key)}
                          disabled={rows.length <= 1}
                          className="text-lg leading-none text-[var(--color-text-muted)] hover:text-[var(--color-error)] disabled:opacity-30 disabled:cursor-not-allowed"
                          aria-label={`${idx + 1}번 행 삭제`}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <button
                type="button"
                onClick={addRow}
                className="mt-2 w-full rounded border border-dashed border-[var(--border-divider)] py-1.5 text-sm text-[var(--color-text-muted)] hover:border-[var(--color-brand-primary)] hover:text-[var(--color-brand-primary)] transition-colors"
              >
                + 추가
              </button>

              <div className="mt-3 rounded border border-[var(--color-border-divider)] bg-[color-mix(in_srgb,var(--color-brand-primary)_4%,var(--color-bg-surface))] p-3">
                <div className="text-xs text-[var(--color-text-muted)]">
                  대상자 자동 등록됨 (이 차시의 모든 수강생) · 커트라인은 첫 번째 행 기준으로 적용
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
                  placeholder="제목 검색"
                  aria-label="템플릿 검색"
                />
                {templatesLoading && <div className="text-sm text-[var(--text-muted)]">불러오는 중…</div>}
                {!templatesLoading && filteredTemplates.length === 0 && (
                  <div className="text-sm text-[var(--text-muted)]">사용 가능한 템플릿이 없습니다.</div>
                )}
                {!templatesLoading && filteredTemplates.length > 0 && (
                  <div className="grid gap-2" style={{ maxHeight: 240, overflowY: "auto" }}>
                    {filteredTemplates.map((t) => {
                      const active = t.id === selectedTemplateId;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => { setSelectedTemplateId(t.id); setTitle(t.title); }}
                          className={`w-full text-left rounded border px-3 py-2 transition-colors ${
                            active ? "border-[var(--color-brand-primary)] bg-[var(--state-selected-bg)]" : "border-[var(--border-divider)] hover:bg-[var(--bg-surface-soft)]"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="text-sm font-semibold text-[var(--text-primary)] truncate">{t.title}</div>
                          </div>
                          {(t.used_lectures?.length ?? 0) > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {t.used_lectures!.slice(0, 4).map((lec) => (
                                <span key={lec.lecture_id} className="ds-badge">{lec.lecture_title}</span>
                              ))}
                              {t.used_lectures!.length > 4 && <span className="ds-badge">+{t.used_lectures!.length - 4}</span>}
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
                placeholder="예) 1주차 과제"
                autoFocus
                aria-label="과제 제목"
              />
              {selectedTemplate && (
                <p className="modal-hint modal-hint--block">템플릿: {selectedTemplate.title}</p>
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
              <Button intent="primary" size="xl" onClick={handleBulkSubmit} disabled={bulkDisabled}>
                {submitting ? "생성 중…" : `일괄 생성 (${rows.filter((r) => r.title.trim()).length})`}
              </Button>
            )}
            {stage === "import" && (
              <Button intent="primary" size="xl" onClick={handleImportSubmit} disabled={importDisabled}>
                {submitting ? "생성 중…" : "생성"}
              </Button>
            )}
          </>
        }
      />
    </AdminModal>
  );
}
