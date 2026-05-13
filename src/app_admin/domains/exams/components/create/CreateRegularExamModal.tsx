// PATH: src/app_admin/domains/exams/components/create/CreateRegularExamModal.tsx
// ------------------------------------------------------------
// 시험 생성 모달 — 신규: 일괄 생성 (제목/만점/커트라인 다중 행)
//                     불러오기(템플릿): 기존 템플릿 import
//                     불러오기(다른 차시): 다른 강의/차시에서 시험 복사
// 대상자 자동 등록
// ------------------------------------------------------------
/* eslint-disable no-restricted-syntax */
// TODO(R-11 cleanup): 이 파일의 인라인 style → className/DS token 마이그레이션. baseline 동결 위해 file-level disable. 신규 인라인 style 추가 시 본 directive 무력화하지 말 것.

import { useEffect, useMemo, useState, useCallback, type CSSProperties } from "react";
import api from "@/shared/api/axios";
import { AdminModal, ModalHeader, ModalBody, ModalFooter, MODAL_WIDTH } from "@/shared/ui/modal";
import { Badge, Button } from "@/shared/ui/ds";
import { SessionBlockView } from "@/shared/ui/session-block";
import { fetchTemplatesWithUsage, type TemplateWithUsage } from "@admin/domains/exams/api/templatesWithUsage";
import { updateAdminExam } from "@admin/domains/exams/api/adminExam";
import { fetchSessionEnrollments } from "@admin/domains/exams/api/sessionEnrollments";
import { updateExamEnrollmentRows } from "@admin/domains/exams/api/examEnrollments";
import SessionItemBrowser, { type SelectedExamItem } from "@admin/domains/sessions/components/SessionItemBrowser";
import { feedback } from "@/shared/ui/feedback/feedback";

type Props = {
  open: boolean;
  onClose: () => void;
  sessionId: number;
  lectureId?: number;
  onCreated: (examId: number) => void;
};

type Stage = "choose" | "new" | "import" | "copy";

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

  // import stage — multi-select
  const [templates, setTemplates] = useState<TemplateWithUsage[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<number>>(new Set());
  const [keyword, setKeyword] = useState("");

  // 차시 수강생 수 — 자동 등록 미리 알리기 위해 모달 오픈 시 1회 조회
  const [enrollmentCount, setEnrollmentCount] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setStage("choose");
    setError(null);
    setSubmitting(false);
    setRows([makeRow()]);
    setTemplates([]);
    setTemplatesLoading(false);
    setSelectedTemplateIds(new Set());
    setKeyword("");
    setEnrollmentCount(null);
    // 차시 수강생 수 preflight — 자동 등록 가능 여부를 미리 안내
    if (sessionId > 0) {
      fetchSessionEnrollments(sessionId)
        .then((list) => setEnrollmentCount(list.length))
        .catch(() => setEnrollmentCount(null));
    }
  }, [open, sessionId]);

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
      .catch((e: unknown) => {
        if (cancelled) return;
        const err = e as { response?: { data?: { detail?: string } }; message?: string };
        setError(err?.response?.data?.detail ?? err?.message ?? "템플릿 목록을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (cancelled) return;
        setTemplatesLoading(false);
      });

    return () => { cancelled = true; };
  }, [open, stage]);

  /**
   * 차시 수강생을 새로 만든 시험에 응시 대상으로 등록.
   * 결과(등록 인원/실패 사유)는 호출 측에서 묶어서 단일 toast로 표시.
   * → 시험 N개 동시 생성 시 toast가 N번 뜨지 않도록 silent 동작, 호출 측이 결과 집계.
   */
  const autoEnroll = useCallback(async (examId: number): Promise<{ enrolled: number; error?: string }> => {
    try {
      const enrollments = await fetchSessionEnrollments(sessionId);
      const ids = enrollments.map((e) => e.enrollment);
      if (ids.length === 0) return { enrolled: 0 };
      await updateExamEnrollmentRows({ examId, sessionId, enrollment_ids: ids });
      return { enrolled: ids.length };
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      return { enrolled: 0, error: err?.response?.data?.detail ?? err?.message ?? "자동 등록 실패" };
    }
  }, [sessionId]);

  // ── Bulk row helpers ──
  const addRow = () => setRows((prev) => [...prev, makeRow()]);

  const removeRow = (rowId: number) =>
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== rowId)));

  const updateRow = (rowId: number, field: keyof Omit<BulkRow, "id">, value: string) =>
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, [field]: value } : r)));

  const moveRow = (rowId: number, direction: "up" | "down") =>
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.id === rowId);
      if (idx < 0) return prev;
      const swap = direction === "up" ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });

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

    const createdIds: number[] = [];
    const failedTitles: string[] = [];
    let enrollMaxPerExam = 0;
    let enrollErrorSample: string | null = null;

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

        const enrollResult = await autoEnroll(newExamId);
        enrollMaxPerExam = Math.max(enrollMaxPerExam, enrollResult.enrolled);
        if (enrollResult.error && !enrollErrorSample) enrollErrorSample = enrollResult.error;

        createdIds.push(newExamId);
      } catch {
        failedTitles.push(row.title.trim());
      }
    }

    setSubmitting(false);

    // onCreated 한 번만 호출 — 마지막 생성된 시험으로 네비게이션
    if (createdIds.length > 0) {
      onCreated(createdIds[createdIds.length - 1]);
    }

    if (createdIds.length > 0) {
      const enrollMsg = enrollErrorSample
        ? ` · 응시 대상 자동 등록 실패 — 시험 상세에서 직접 등록하세요`
        : enrollMaxPerExam > 0
        ? ` · 수강생 ${enrollMaxPerExam}명 응시 대상 등록됨`
        : ` · 응시 대상이 등록되지 않았습니다 (차시 수강생 0명)`;
      if (failedTitles.length === 0) {
        feedback.success(`${createdIds.length}개 시험 생성 완료${enrollMsg}`);
      } else {
        feedback.warning(
          `${createdIds.length}개 생성 완료, ${failedTitles.length}개 실패: ${failedTitles.join(", ")}${enrollMsg}`
        );
      }
      onClose();
    } else {
      setError(`시험 생성 실패: ${failedTitles.join(", ")}`);
    }
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

    let enrollMaxPerExam = 0;
    let enrollErrorSample: string | null = null;

    for (const tpl of selected) {
      try {
        const res = await api.post("/exams/", {
          title: tpl.title,
          description: "",
          exam_type: "regular",
          session_id: sessionId,
          template_exam_id: tpl.id,
        });
        const newExamId = Number(res.data?.id);
        if (!newExamId) throw new Error("생성 후 ID를 받지 못했습니다.");

        const enrollResult = await autoEnroll(newExamId);
        enrollMaxPerExam = Math.max(enrollMaxPerExam, enrollResult.enrolled);
        if (enrollResult.error && !enrollErrorSample) enrollErrorSample = enrollResult.error;
        createdIds.push(newExamId);
      } catch {
        failedTitles.push(tpl.title);
      }
    }

    setSubmitting(false);

    if (createdIds.length > 0) {
      // onCreated 한 번만 호출 — 마지막 생성된 시험으로 네비게이션
      onCreated(createdIds[createdIds.length - 1]);
    }

    if (createdIds.length > 0) {
      const enrollMsg = enrollErrorSample
        ? ` · 응시 대상 자동 등록 실패 — 시험 상세에서 직접 등록하세요`
        : enrollMaxPerExam > 0
        ? ` · 수강생 ${enrollMaxPerExam}명 응시 대상 등록됨`
        : ` · 응시 대상이 등록되지 않았습니다 (차시 수강생 0명)`;
      if (failedTitles.length === 0) {
        feedback.success(`${createdIds.length}개 시험 가져오기 완료${enrollMsg}`);
      } else {
        feedback.warning(`${createdIds.length}개 가져오기 완료, ${failedTitles.length}개 실패: ${failedTitles.join(", ")}${enrollMsg}`);
      }
      onClose();
    } else {
      setError(`시험 생성 실패: ${failedTitles.join(", ")}`);
    }
  };

  // ── Copy submit (from other session) ──
  const handleCopyExams = async (items: SelectedExamItem[]) => {
    if (!sessionId || items.length === 0) return;

    setError(null);
    setSubmitting(true);

    const createdIds: number[] = [];
    const failedTitles: string[] = [];

    let enrollMaxPerExam = 0;
    let enrollErrorSample: string | null = null;

    for (const item of items) {
      try {
        // Create new exam in current session (copy — no template link)
        const res = await api.post("/exams/", {
          title: item.title,
          description: "",
          exam_type: "regular",
          session_id: sessionId,
        });
        const newExamId = Number(res.data?.id);
        if (!newExamId) throw new Error("생성 후 ID를 받지 못했습니다.");

        // Copy max_score, pass_score from source
        await updateAdminExam(newExamId, {
          max_score: item.max_score,
          pass_score: item.pass_score,
          answer_visibility: "hidden",
        });

        const enrollResult = await autoEnroll(newExamId);
        enrollMaxPerExam = Math.max(enrollMaxPerExam, enrollResult.enrolled);
        if (enrollResult.error && !enrollErrorSample) enrollErrorSample = enrollResult.error;
        createdIds.push(newExamId);
      } catch {
        failedTitles.push(item.title);
      }
    }

    setSubmitting(false);

    // onCreated 한 번만 호출 — 마지막 생성된 시험으로 네비게이션
    if (createdIds.length > 0) {
      onCreated(createdIds[createdIds.length - 1]);
    }

    if (createdIds.length > 0) {
      const enrollMsg = enrollErrorSample
        ? ` · 응시 대상 자동 등록 실패 — 시험 상세에서 직접 등록하세요`
        : enrollMaxPerExam > 0
        ? ` · 수강생 ${enrollMaxPerExam}명 응시 대상 등록됨`
        : ` · 응시 대상이 등록되지 않았습니다 (차시 수강생 0명)`;
      if (failedTitles.length === 0) {
        feedback.success(`${createdIds.length}개 시험 양식 복사 완료${enrollMsg}`);
      } else {
        feedback.warning(
          `${createdIds.length}개 복사 완료, ${failedTitles.length}개 실패: ${failedTitles.join(", ")}${enrollMsg}`
        );
      }
      onClose();
    } else {
      setError(`시험 복사 실패: ${failedTitles.join(", ")}`);
    }
  };

  const importDisabled = submitting || !(sessionId > 0) || selectedTemplateIds.size === 0;

  const bulkHasAnyTitle = rows.some((r) => r.title.trim());

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

  const stageLabels: Record<Stage, string> = {
    choose: "시험 만들기",
    new: "직접 만들기",
    import: "이전 시험에서 가져오기",
    copy: "다른 차시 양식 복사",
  };

  const headerTitle =
    stage === "choose" ? (
      stageLabels.choose
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
            ? "이 차시에 적용할 시험을 만듭니다. 만들어진 시험에는 차시 수강생이 자동으로 응시 대상으로 등록됩니다."
            : stage === "new"
            ? "제목·만점·커트라인을 입력해 새 시험을 만듭니다. 한 번에 여러 개도 만들 수 있어요."
            : stage === "copy"
            ? "다른 차시의 시험 양식(만점·커트라인)만 가져와 새로 만듭니다. 원본과 별도로 관리됩니다."
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

          {/* 차시 수강생 0명 경고 — 자동 등록 거짓말 방지 */}
          {stage !== "choose" && enrollmentCount === 0 && (
            <div
              className="mb-3 flex items-start gap-2 rounded-lg border px-3 py-2.5"
              style={{
                borderColor: "color-mix(in srgb, var(--color-warning) 50%, var(--color-border-divider))",
                background: "color-mix(in srgb, var(--color-warning) 8%, var(--color-bg-surface))",
              }}
            >
              <span aria-hidden="true" style={{ fontSize: 16 }}>⚠</span>
              <div className="text-xs leading-relaxed">
                <strong>이 차시에 등록된 수강생이 없습니다.</strong> 시험은 만들 수 있지만 응시 대상이 자동 등록되지 않습니다.
                먼저 차시에 수강생을 등록한 뒤 시험을 만드세요.
              </div>
            </div>
          )}

          {/* ── Stage: choose ── */}
          {stage === "choose" && (
            <div className="modal-form-group">
              <div className="modal-section-label mb-3">어떻게 만들까요?</div>
              <div className="grid grid-cols-3 gap-3">
                <SessionBlockView
                  variant="n1"
                  compact={false}
                  selected={false}
                  showCheck
                  className="session-block--card-sm"
                  title="직접 만들기"
                  desc="제목·만점·커트라인을 입력해 새 시험을 만듭니다. (1개~여러 개)"
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
                  className="session-block--card-sm"
                  title="이전 시험에서 가져오기 (연결)"
                  desc="이전에 만들어 둔 시험 양식·답안을 그대로 적용. 원본을 고치면 같이 바뀝니다."
                  onClick={() => {
                    setError(null);
                    setSelectedTemplateIds(new Set());
                    setKeyword("");
                    setStage("import");
                  }}
                />
                <SessionBlockView
                  variant="n1"
                  compact={false}
                  selected={false}
                  showCheck
                  className="session-block--card-sm"
                  title="다른 차시 양식 복사 (독립)"
                  desc="다른 차시 시험의 만점·커트라인만 복사. 답안·문항은 새로 만들고 원본과 분리됩니다."
                  onClick={() => {
                    setError(null);
                    setStage("copy");
                  }}
                />
              </div>
            </div>
          )}

          {/* ── Stage: new (bulk rows) ── */}
          {stage === "new" && (
            <div className="modal-form-group">
              <table className="ds-table w-full" style={{ tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: 56 }} />
                  <col />
                  <col style={{ width: 90 }} />
                  <col style={{ width: 90 }} />
                  <col style={{ width: 40 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th className="text-center text-xs font-semibold" style={{ padding: "6px 4px" }}>순서</th>
                    <th className="text-left text-xs font-semibold" style={{ padding: "6px 8px" }}>제목</th>
                    <th className="text-left text-xs font-semibold" style={{ padding: "6px 8px" }}>만점</th>
                    <th className="text-left text-xs font-semibold" style={{ padding: "6px 8px" }}>
                      <span className="inline-flex items-center gap-1">
                        커트라인
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border border-[var(--color-border-divider)] text-[var(--color-text-muted)] bg-[var(--color-bg-surface)]">
                          점
                        </span>
                      </span>
                    </th>
                    <th style={{ padding: "6px 8px" }} />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={row.id}>
                      <td style={{ padding: "4px 4px", textAlign: "center" }}>
                        <div className="inline-flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => moveRow(row.id, "up")}
                            disabled={idx === 0}
                            className="text-base leading-none px-1 text-[var(--color-text-muted)] hover:text-[var(--color-brand-primary)] disabled:opacity-25 disabled:cursor-not-allowed"
                            aria-label={`${idx + 1}번 행 위로`}
                            title="위로"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            onClick={() => moveRow(row.id, "down")}
                            disabled={idx === rows.length - 1}
                            className="text-base leading-none px-1 text-[var(--color-text-muted)] hover:text-[var(--color-brand-primary)] disabled:opacity-25 disabled:cursor-not-allowed"
                            aria-label={`${idx + 1}번 행 아래로`}
                            title="아래로"
                          >
                            ▼
                          </button>
                        </div>
                      </td>
                      <td style={{ padding: "4px 8px" }}>
                        <input
                          className="ds-input w-full"
                          style={{ minHeight: 40, fontSize: 14, padding: "10px 12px" }}
                          value={row.title}
                          onChange={(e) => updateRow(row.id, "title", e.target.value)}
                          placeholder={`시험 ${idx + 1}`}
                          autoFocus={idx === 0}
                          aria-label={`시험 ${idx + 1} 제목`}
                        />
                      </td>
                      <td style={{ padding: "4px 8px" }}>
                        <input
                          type="number"
                          min={1}
                          className="ds-input w-full"
                          value={row.maxScore}
                          onChange={(e) => updateRow(row.id, "maxScore", e.target.value)}
                          placeholder="100"
                          aria-label={`시험 ${idx + 1} 만점`}
                        />
                      </td>
                      <td style={{ padding: "4px 8px" }}>
                        <input
                          type="number"
                          min={0}
                          className="ds-input w-full"
                          value={row.passScore}
                          onChange={(e) => updateRow(row.id, "passScore", e.target.value)}
                          placeholder="0"
                          aria-label={`시험 ${idx + 1} 커트라인`}
                        />
                      </td>
                      <td style={{ padding: "4px 8px", textAlign: "center" }}>
                        <button
                          type="button"
                          onClick={() => removeRow(row.id)}
                          disabled={rows.length <= 1}
                          className="text-lg leading-none text-[var(--color-text-muted)] hover:text-[var(--color-error)] disabled:opacity-30 disabled:cursor-not-allowed"
                          aria-label="행 삭제"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Add row button */}
              <button
                type="button"
                onClick={addRow}
                className="mt-2 w-full rounded border border-dashed border-[var(--color-border-divider)] py-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-brand-primary)] hover:border-[var(--color-brand-primary)] transition-colors"
              >
                + 추가
              </button>

              {/* 안내 박스 — 자동 등록 결과는 생성 후 toast로 명시 노출 (별도 처리) */}
              <div className="mt-3 rounded border border-[var(--color-border-divider)] bg-[color-mix(in_srgb,var(--color-brand-primary)_4%,var(--color-bg-surface))] p-3">
                <div className="text-xs text-[var(--color-text-muted)]">
                  이 차시의 수강생이 자동으로 응시 대상으로 등록됩니다. · 커트라인 미만 점수는 클리닉 보강 대상으로 표시됩니다.
                </div>
              </div>
            </div>
          )}

          {/* ── Stage: copy (from other session) ── */}
          {stage === "copy" && (
            <div className="modal-form-group">
              {submitting ? (
                <div className="text-center py-8 text-sm text-[var(--color-text-muted)]">
                  시험을 복사 생성하는 중…
                </div>
              ) : (
                <SessionItemBrowser
                  mode="exam"
                  excludeSessionId={sessionId}
                  onSelectExams={handleCopyExams}
                />
              )}
            </div>
          )}

          {/* ── Stage: import (multi-select) ── */}
          {stage === "import" && (
            <div className="modal-form-group">
              <div className="flex items-center justify-between mb-1">
                <label className="modal-section-label">불러올 시험 선택 (이전에 만든 시험)</label>
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
                  <div className="grid gap-2" style={{ maxHeight: 320, overflowY: "auto" }}>
                    {filteredTemplates.map((t) => {
                      const checked = selectedTemplateIds.has(t.id);
                      const lecturesList = [...(t.used_lectures ?? [])].sort((a, b) =>
                        String(b.last_used_date ?? "").localeCompare(String(a.last_used_date ?? ""))
                      );
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
                            checked
                              ? "border-[var(--color-brand-primary)] bg-[var(--state-selected-bg)]"
                              : "border-[var(--border-divider)] hover:bg-[var(--bg-surface-soft)]"
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
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-semibold text-[var(--text-primary)] truncate">
                                {t.title}
                              </div>
                              <div className="mt-0.5 text-xs text-[var(--text-muted)]">
                                {t.subject ? `과목: ${t.subject}` : "과목: -"}
                              </div>
                            </div>
                          </div>
                          {lecturesList.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5 ml-6">
                              {lecturesList.slice(0, 4).map((lec) => (
                                <Badge
                                  key={lec.lecture_id}
                                  style={
                                    lec.color
                                      ? ({
                                          "--badge-bg": `color-mix(in srgb, ${lec.color} 18%, var(--bg-surface-soft))`,
                                          "--badge-text": "var(--text-primary)",
                                        } as CSSProperties)
                                      : undefined
                                  }
                                >
                                  {(lec.chip_label ? `${lec.chip_label} ` : "") + lec.lecture_title}
                                </Badge>
                              ))}
                              {lecturesList.length > 4 && (
                                <Badge>+{lecturesList.length - 4}</Badge>
                              )}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <p className="modal-hint modal-hint--block mt-2">
                선택한 시험의 제목·양식·답안이 그대로 적용됩니다. 원본을 고치면 이 차시에도 반영돼요.
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
              <Button
                intent="primary"
                size="xl"
                onClick={handleBulkSubmit}
                disabled={submitting || !bulkHasAnyTitle}
              >
                {submitting ? "만드는 중…" : `${rows.filter((r) => r.title.trim()).length}개 시험 만들기`}
              </Button>
            )}
            {stage === "import" && (
              <Button
                intent="primary"
                size="xl"
                onClick={handleImportSubmit}
                disabled={importDisabled}
              >
                {submitting ? "만드는 중…" : `${selectedTemplateIds.size}개 시험 가져오기`}
              </Button>
            )}
          </>
        }
      />
    </AdminModal>
  );
}
