// PATH: src/app_admin/domains/homework/components/CreateHomeworkModal.tsx
// ------------------------------------------------------------
// 과제 생성 모달 — 일괄 생성(bulk) 지원
// 신규: 행 기반 폼으로 여러 과제를 한 번에 생성
// 불러오기(템플릿): 기존 템플릿 import 유지
// 불러오기(다른 차시): 다른 강의/차시에서 과제 복사
// 대상자 자동 등록
// ------------------------------------------------------------

import { useEffect, useState, useMemo, useCallback } from "react";
import api from "@/shared/api/axios";
import { AdminModal, ModalHeader, ModalBody, ModalFooter, MODAL_WIDTH } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { SessionBlockView } from "@/shared/ui/session-block";
import { fetchHomeworkTemplatesWithUsage, type HomeworkTemplateWithUsage } from "../api/adminHomework";
import { fetchHomeworkPolicyBySession, patchHomeworkPolicy } from "../api/homeworkPolicy";
import { fetchSessionEnrollments } from "@admin/domains/exams/api/sessionEnrollments";
import { putHomeworkAssignments } from "../api/homeworkAssignments";
import SessionItemBrowser, { type SelectedHomeworkItem } from "@admin/domains/sessions/components/SessionItemBrowser";
import { feedback } from "@/shared/ui/feedback/feedback";

type Props = {
  open: boolean;
  onClose: () => void;
  sessionId: number;
  onCreated: (newId: number) => void;
};

type Stage = "choose" | "new" | "import" | "copy";

type CutlineMode = "PERCENT" | "COUNT";

type BulkRow = {
  key: number;
  title: string;
  maxScore: string;
  cutline: string;
  dueDate: string;
};

function getDefaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

let rowKeyCounter = 0;
function makeRow(): BulkRow {
  return { key: ++rowKeyCounter, title: "", maxScore: "100", cutline: "80", dueDate: getDefaultDueDate() };
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
  const [cutlineMode, setCutlineMode] = useState<CutlineMode>("PERCENT");

  // import stage state — multi-select
  const [templates, setTemplates] = useState<HomeworkTemplateWithUsage[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<number>>(new Set());
  const [keyword, setKeyword] = useState("");

  useEffect(() => {
    if (!open) return;
    setStage("choose");
    setError(null);
    setSubmitting(false);
    setRows([makeRow()]);
    setCutlineMode("PERCENT");
    setTemplates([]);
    setTemplatesLoading(false);
    setSelectedTemplateIds(new Set());
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

    const createdIds: number[] = [];
    const failed: string[] = [];

    // Apply cutline from the first row
    const firstCutline = Number(validRows[0].cutline);
    let policyPatched = false;

    try {
      const policy = await fetchHomeworkPolicyBySession(sessionId);
      if (policy?.id) {
        await patchHomeworkPolicy(policy.id, {
          cutline_mode: cutlineMode,
          cutline_value: Number.isFinite(firstCutline) && firstCutline >= 0 ? firstCutline : (cutlineMode === "PERCENT" ? 80 : 40),
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

        // Save max_score + due_date
        const ms = Number(row.maxScore);
        const metaPatch: Record<string, any> = {};
        if (Number.isFinite(ms) && ms > 0) metaPatch.default_max_score = ms;
        if (row.dueDate) metaPatch.due_date = row.dueDate;
        if (Object.keys(metaPatch).length > 0) {
          try {
            await api.patch(`/homeworks/${newId}/`, { meta: metaPatch });
          } catch {
            // best-effort
          }
        }

        // Auto-enroll
        void autoEnroll(newId);

        createdIds.push(newId);
      } catch (e: any) {
        failed.push(row.title.trim());
      }
    }

    setSubmitting(false);

    // onCreated 한 번만 호출 — 마지막 생성된 과제로 네비게이션
    if (createdIds.length > 0) {
      onCreated(createdIds[createdIds.length - 1]);
    }

    if (createdIds.length > 0) {
      const msg = `${createdIds.length}개 과제 생성 완료` +
        (policyPatched ? ` (커트라인 ${firstCutline}${cutlineMode === "PERCENT" ? "%" : "점"})` : "") +
        (failed.length > 0 ? ` · ${failed.length}개 실패` : "");
      feedback.success(msg);
    }
    if (failed.length > 0 && createdIds.length === 0) {
      setError(`모든 과제 생성에 실패했습니다: ${failed.join(", ")}`);
      return;
    }
    onClose();
  };

  // ── Import submit (multi-template) ──
  const handleImportSubmit = async () => {
    if (!sessionId) {
      setError("세션 정보가 없습니다.");
      return;
    }
    if (selectedTemplateIds.size === 0) {
      setError("불러올 템플릿을 선택하세요.");
      return;
    }
    setError(null);
    setSubmitting(true);

    const selected = templates.filter((t) => selectedTemplateIds.has(t.id));
    const createdIds: number[] = [];
    const failedTitles: string[] = [];

    for (const tpl of selected) {
      try {
        const res = await api.post("/homeworks/", {
          session_id: sessionId,
          title: tpl.title,
          template_homework_id: tpl.id,
        });
        const newId = Number(res.data?.id ?? res.data?.homework_id ?? res.data?.pk);
        if (!Number.isFinite(newId) || newId <= 0) throw new Error("생성 후 ID를 받지 못했습니다.");

        void autoEnroll(newId);
        createdIds.push(newId);
      } catch {
        failedTitles.push(tpl.title);
      }
    }

    setSubmitting(false);

    if (createdIds.length > 0) {
      // onCreated 한 번만 호출 — 마지막 생성된 과제로 네비게이션
      onCreated(createdIds[createdIds.length - 1]);
    }

    if (failedTitles.length === 0) {
      feedback.success(`${createdIds.length}개 템플릿 과제 생성 완료`);
      onClose();
    } else if (createdIds.length > 0) {
      feedback.warning(`${createdIds.length}개 생성 완료, ${failedTitles.length}개 실패: ${failedTitles.join(", ")}`);
      onClose();
    } else {
      setError(`과제 생성 실패: ${failedTitles.join(", ")}`);
    }
  };

  // ── Copy submit (from other session) ──
  const handleCopyHomeworks = async (items: SelectedHomeworkItem[]) => {
    if (!sessionId || items.length === 0) return;

    setError(null);
    setSubmitting(true);

    const createdIds: number[] = [];
    const failed: string[] = [];

    for (const item of items) {
      try {
        const res = await api.post("/homeworks/", {
          session_id: sessionId,
          title: item.title,
        });
        const newId = Number(res.data?.id ?? res.data?.homework_id ?? res.data?.pk);
        if (!Number.isFinite(newId) || newId <= 0) throw new Error("생성 후 ID를 받지 못했습니다.");

        // Copy max_score from source
        if (item.max_score > 0) {
          try {
            await api.patch(`/homeworks/${newId}/`, {
              meta: { default_max_score: item.max_score },
            });
          } catch {
            // best-effort
          }
        }

        void autoEnroll(newId);
        createdIds.push(newId);
      } catch {
        failed.push(item.title);
      }
    }

    setSubmitting(false);

    // onCreated 한 번만 호출 — 마지막 생성된 과제로 네비게이션
    if (createdIds.length > 0) {
      onCreated(createdIds[createdIds.length - 1]);
    }

    if (createdIds.length > 0) {
      const msg = `${createdIds.length}개 과제 불러오기 완료 (복사 생성)` +
        (failed.length > 0 ? ` · ${failed.length}개 실패` : "");
      feedback.success(msg);
    }
    if (failed.length > 0 && createdIds.length === 0) {
      setError(`모든 과제 복사에 실패했습니다: ${failed.join(", ")}`);
      return;
    }
    onClose();
  };

  const bulkDisabled = submitting || rows.every((r) => !r.title.trim());
  const importDisabled = submitting || selectedTemplateIds.size === 0;
  const filteredTemplates = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    const base = [...templates].sort((a, b) =>
      (b.last_used_date ?? "").localeCompare(a.last_used_date ?? "")
    );
    if (!k) return base;
    return base.filter((t) => (t.title ?? "").toLowerCase().includes(k));
  }, [templates, keyword]);

  if (!open) return null;

  const stageLabels: Record<Stage, string> = {
    choose: "과제 생성",
    new: "일괄 과제 생성",
    import: "템플릿 불러오기",
    copy: "다른 차시에서 불러오기",
  };

  const headerTitle =
    stage === "choose" ? (
      stageLabels.choose
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
        <span>{stageLabels[stage]}</span>
      </div>
    );

  return (
    <AdminModal
      open
      onClose={onClose}
      type="action"
      width={stage === "copy" ? MODAL_WIDTH.wide : stage === "choose" ? MODAL_WIDTH.form : MODAL_WIDTH.default}
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
            ? "신규 과제를 만들거나, 기존 과제를 불러와 이 차시에 적용할 수 있습니다. 대상자는 자동 등록됩니다."
            : stage === "new"
            ? "여러 과제를 한 번에 생성할 수 있습니다. 행을 추가하고 일괄 생성하세요."
            : stage === "copy"
            ? "다른 강의/차시의 과제를 선택하여 현재 차시에 복사 생성합니다."
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
              <div className="grid grid-cols-3 gap-3">
                <SessionBlockView
                  variant="n1"
                  compact={false}
                  selected={false}
                  showCheck
                  className="session-block--card-sm"
                  title="신규 과제"
                  desc="이 차시에 새 과제를 생성합니다."
                  onClick={() => { setError(null); setRows([makeRow()]); setStage("new"); }}
                />
                <SessionBlockView
                  variant="supplement"
                  compact={false}
                  selected={false}
                  showCheck
                  className="session-block--card-sm"
                  title="템플릿 불러오기"
                  desc="과제 템플릿을 여러 개 선택하여 일괄 생성합니다."
                  onClick={() => { setError(null); setKeyword(""); setSelectedTemplateIds(new Set()); setStage("import"); }}
                />
                <SessionBlockView
                  variant="n1"
                  compact={false}
                  selected={false}
                  showCheck
                  className="session-block--card-sm"
                  title="다른 차시에서"
                  desc="다른 강의/차시의 과제를 복사합니다."
                  onClick={() => { setError(null); setStage("copy"); }}
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
                  <col style={{ width: 80 }} />
                  <col style={{ width: 90 }} />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 40 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th className="text-left text-xs font-semibold" style={{ padding: "6px 8px" }}>제목</th>
                    <th className="text-left text-xs font-semibold" style={{ padding: "6px 8px" }}>만점</th>
                    <th className="text-left text-xs font-semibold" style={{ padding: "6px 4px" }}>
                      <span className="inline-flex items-center gap-1">
                        커트라인
                        <button
                          type="button"
                          onClick={() => setCutlineMode((m) => m === "PERCENT" ? "COUNT" : "PERCENT")}
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border border-[var(--color-border-divider)] hover:border-[var(--color-brand-primary)] text-[var(--color-brand-primary)] bg-[var(--color-bg-surface)]"
                          title="클릭하여 전환"
                        >
                          {cutlineMode === "PERCENT" ? "%" : "점"}
                        </button>
                      </span>
                    </th>
                    <th className="text-left text-xs font-semibold" style={{ padding: "6px 8px" }}>제출기한</th>
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
                          value={idx === 0 ? row.cutline : rows[0]?.cutline ?? row.cutline}
                          onChange={(e) => { if (idx === 0) updateRow(row.key, "cutline", e.target.value); }}
                          disabled={idx > 0}
                          title={idx > 0 ? "커트라인은 첫 번째 행 값이 공통 적용됩니다" : undefined}
                          aria-label={`과제 ${idx + 1} 커트라인`}
                          style={idx > 0 ? { opacity: 0.5 } : undefined}
                        />
                      </td>
                      <td style={{ padding: "4px 8px" }}>
                        <input
                          type="date"
                          className="ds-input w-full"
                          value={row.dueDate}
                          onChange={(e) => updateRow(row.key, "dueDate", e.target.value)}
                          aria-label={`과제 ${idx + 1} 제출기한`}
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
                  대상자 자동 등록됨 (이 차시의 모든 수강생) · 커트라인은 첫 번째 행 값이 전체 과제에 공통 적용됩니다 · {cutlineMode === "PERCENT" ? "퍼센트(%) 기준" : "점수 기준"} · 커트라인 미만 시 클리닉 보강 대상
                </div>
              </div>
            </div>
          )}

          {/* ── Stage: copy (from other session) ── */}
          {stage === "copy" && (
            <div className="modal-form-group">
              {submitting ? (
                <div className="text-center py-8 text-sm text-[var(--color-text-muted)]">
                  과제를 복사 생성하는 중…
                </div>
              ) : (
                <SessionItemBrowser
                  mode="homework"
                  excludeSessionId={sessionId}
                  onSelectHomeworks={handleCopyHomeworks}
                />
              )}
            </div>
          )}

          {/* ── Stage: import (multi-select) ── */}
          {stage === "import" && (
            <div className="modal-form-group">
              <div className="flex items-center justify-between mb-1">
                <label className="modal-section-label">템플릿 선택</label>
                {selectedTemplateIds.size > 0 && (
                  <span className="text-xs font-semibold text-[var(--color-brand-primary)]">
                    {selectedTemplateIds.size}개 선택됨
                  </span>
                )}
              </div>
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
                  <div className="grid gap-2" style={{ maxHeight: 320, overflowY: "auto" }}>
                    {filteredTemplates.map((t) => {
                      const checked = selectedTemplateIds.has(t.id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setSelectedTemplateIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(t.id)) next.delete(t.id);
                              else next.add(t.id);
                              return next;
                            });
                          }}
                          className={`w-full text-left rounded border px-3 py-2 transition-colors ${
                            checked ? "border-[var(--color-brand-primary)] bg-[var(--state-selected-bg)]" : "border-[var(--border-divider)] hover:bg-[var(--bg-surface-soft)]"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              readOnly
                              className="accent-[var(--color-brand-primary)] pointer-events-none"
                              tabIndex={-1}
                            />
                            <div className="text-sm font-semibold text-[var(--text-primary)] truncate">{t.title}</div>
                          </div>
                          {(t.used_lectures?.length ?? 0) > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5 ml-6">
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
              <p className="modal-hint modal-hint--block mt-2">
                템플릿 제목이 과제 이름으로 사용됩니다. 여러 개를 선택하여 일괄 생성할 수 있습니다.
              </p>
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
                {submitting ? "생성 중…" : `일괄 생성${selectedTemplateIds.size > 1 ? ` (${selectedTemplateIds.size}개)` : ""}`}
              </Button>
            )}
          </>
        }
      />
    </AdminModal>
  );
}
