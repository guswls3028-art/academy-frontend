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
import { Badge, Button } from "@/shared/ui/ds";
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

  // 차시 수강생 수 — 자동 등록 미리 알리기 위해 모달 오픈 시 1회 조회
  const [enrollmentCount, setEnrollmentCount] = useState<number | null>(null);

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
    setEnrollmentCount(null);
    if (sessionId > 0) {
      fetchSessionEnrollments(sessionId)
        .then((list) => setEnrollmentCount(list.length))
        .catch(() => setEnrollmentCount(null));
    }
  }, [open, sessionId]);

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

  /** 결과를 반환하도록 변경 — 호출 측이 N개 생성 시 단일 toast로 집계 */
  const autoEnroll = useCallback(async (homeworkId: number): Promise<{ enrolled: number; error?: string }> => {
    try {
      const enrollments = await fetchSessionEnrollments(sessionId);
      const ids = enrollments.map((e) => e.enrollment);
      if (ids.length === 0) return { enrolled: 0 };
      await putHomeworkAssignments({ homeworkId, enrollment_ids: ids });
      return { enrolled: ids.length };
    } catch (e: any) {
      return { enrolled: 0, error: e?.response?.data?.detail ?? e?.message ?? "자동 등록 실패" };
    }
  }, [sessionId]);

  // ── Bulk row helpers ──
  const addRow = () => setRows((prev) => [...prev, makeRow()]);

  const removeRow = (key: number) =>
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.key !== key)));

  const updateRow = (key: number, field: keyof Omit<BulkRow, "key">, value: string) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));

  const moveRow = (key: number, direction: "up" | "down") =>
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.key === key);
      if (idx < 0) return prev;
      const swap = direction === "up" ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });

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

    // 커트라인은 row[0]의 입력값을 항상 사용 (UI에서 row[0]만 편집 가능).
    // 과거 validRows[0] 사용 시 row[0] 제목이 비어 있으면 다른 행의 default(80)가 잘못 들어가는 버그가 있었음.
    // 2026-05-12 fix: 사용자가 0 입력 시도 — Math.max 가드만 적용, 명시적 silent default 제거.
    // PERCENT 모드 0~100, COUNT 모드 0~(int 상한). 0 = "모두 합격" 의도 명확. firstCutline NaN/빈값일
    // 때만 안전 default (이전엔 0/음수도 default fallback → 사용자 0 입력 의도 깨졌음).
    const firstCutlineRaw = Number(rows[0]?.cutline);
    const firstCutline = Number.isFinite(firstCutlineRaw)
      ? (cutlineMode === "PERCENT"
        ? Math.max(0, Math.min(100, Math.trunc(firstCutlineRaw)))
        : Math.max(0, Math.trunc(firstCutlineRaw)))
      : null;  // 빈값/NaN 만 null → default 적용
    let policyPatched = false;
    let policyError: string | null = null;

    try {
      const policy = await fetchHomeworkPolicyBySession(sessionId);
      if (policy?.id) {
        await patchHomeworkPolicy(policy.id, {
          cutline_mode: cutlineMode,
          cutline_value: firstCutline !== null ? firstCutline : (cutlineMode === "PERCENT" ? 80 : 40),
        });
        policyPatched = true;
      } else {
        policyError = "세션 정책 조회 실패 — 커트라인이 적용되지 않았습니다.";
      }
    } catch (e: any) {
      policyError = e?.response?.data?.detail || "커트라인 저장 실패";
    }

    let enrollMaxPerHw = 0;
    let enrollErrorSample: string | null = null;

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

        const enrollResult = await autoEnroll(newId);
        enrollMaxPerHw = Math.max(enrollMaxPerHw, enrollResult.enrolled);
        if (enrollResult.error && !enrollErrorSample) enrollErrorSample = enrollResult.error;

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
      const enrollMsg = enrollErrorSample
        ? ` · 제출 대상 자동 등록 실패 — 과제 상세에서 직접 등록하세요`
        : enrollMaxPerHw > 0
        ? ` · 수강생 ${enrollMaxPerHw}명 제출 대상 등록됨`
        : ` · 제출 대상이 등록되지 않았습니다 (차시 수강생 0명)`;
      const msg = `${createdIds.length}개 과제 생성 완료` +
        (policyPatched ? ` (커트라인 ${firstCutline}${cutlineMode === "PERCENT" ? "%" : "점"})` : "") +
        (failed.length > 0 ? ` · ${failed.length}개 실패` : "") +
        enrollMsg;
      feedback.success(msg);
    }
    if (policyError) {
      // 커트라인 저장 실패는 silent fail이 아니라 명시 노출 — 학원장이 즉시 인지
      feedback.warning(policyError);
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

    let enrollMaxPerHw = 0;
    let enrollErrorSample: string | null = null;

    for (const tpl of selected) {
      try {
        const res = await api.post("/homeworks/", {
          session_id: sessionId,
          title: tpl.title,
          template_homework_id: tpl.id,
        });
        const newId = Number(res.data?.id ?? res.data?.homework_id ?? res.data?.pk);
        if (!Number.isFinite(newId) || newId <= 0) throw new Error("생성 후 ID를 받지 못했습니다.");

        const enrollResult = await autoEnroll(newId);
        enrollMaxPerHw = Math.max(enrollMaxPerHw, enrollResult.enrolled);
        if (enrollResult.error && !enrollErrorSample) enrollErrorSample = enrollResult.error;
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

    if (createdIds.length > 0) {
      const enrollMsg = enrollErrorSample
        ? ` · 제출 대상 자동 등록 실패 — 과제 상세에서 직접 등록하세요`
        : enrollMaxPerHw > 0
        ? ` · 수강생 ${enrollMaxPerHw}명 제출 대상 등록됨`
        : ` · 제출 대상이 등록되지 않았습니다 (차시 수강생 0명)`;
      if (failedTitles.length === 0) {
        feedback.success(`${createdIds.length}개 과제 가져오기 완료${enrollMsg}`);
      } else {
        feedback.warning(`${createdIds.length}개 가져오기 완료, ${failedTitles.length}개 실패: ${failedTitles.join(", ")}${enrollMsg}`);
      }
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

    let enrollMaxPerHw = 0;
    let enrollErrorSample: string | null = null;

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

        const enrollResult = await autoEnroll(newId);
        enrollMaxPerHw = Math.max(enrollMaxPerHw, enrollResult.enrolled);
        if (enrollResult.error && !enrollErrorSample) enrollErrorSample = enrollResult.error;
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
      const enrollMsg = enrollErrorSample
        ? ` · 제출 대상 자동 등록 실패 — 과제 상세에서 직접 등록하세요`
        : enrollMaxPerHw > 0
        ? ` · 수강생 ${enrollMaxPerHw}명 제출 대상 등록됨`
        : ` · 제출 대상이 등록되지 않았습니다 (차시 수강생 0명)`;
      const msg = `${createdIds.length}개 과제 양식 복사 완료` +
        (failed.length > 0 ? ` · ${failed.length}개 실패` : "") +
        enrollMsg;
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
    choose: "과제 만들기",
    new: "직접 만들기",
    import: "이전 과제에서 가져오기",
    copy: "다른 차시 양식 복사",
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
            ? "이 차시에 적용할 과제를 만듭니다. 만들어진 과제에는 차시 수강생이 자동으로 제출 대상으로 등록됩니다."
            : stage === "new"
            ? "제목·만점·커트라인·제출기한을 입력해 새 과제를 만듭니다. 한 번에 여러 개도 만들 수 있어요."
            : stage === "copy"
            ? "다른 차시의 과제 양식만 가져와 새로 만듭니다. 원본과 별도로 관리됩니다."
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
                <strong>이 차시에 등록된 수강생이 없습니다.</strong> 과제는 만들 수 있지만 제출 대상이 자동 등록되지 않습니다.
                먼저 차시에 수강생을 등록한 뒤 과제를 만드세요.
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
                  desc="제목·만점·커트라인·기한을 입력해 새 과제를 만듭니다. (1개~여러 개)"
                  onClick={() => { setError(null); setRows([makeRow()]); setStage("new"); }}
                />
                <SessionBlockView
                  variant="supplement"
                  compact={false}
                  selected={false}
                  showCheck
                  className="session-block--card-sm"
                  title="이전 과제에서 가져오기 (연결)"
                  desc="이전에 만들어 둔 과제 양식을 그대로 적용. 원본을 고치면 같이 바뀝니다."
                  onClick={() => { setError(null); setKeyword(""); setSelectedTemplateIds(new Set()); setStage("import"); }}
                />
                <SessionBlockView
                  variant="n1"
                  compact={false}
                  selected={false}
                  showCheck
                  className="session-block--card-sm"
                  title="다른 차시 양식 복사 (독립)"
                  desc="다른 차시 과제의 양식만 복사. 새로 만들고 원본과 분리됩니다."
                  onClick={() => { setError(null); setStage("copy"); }}
                />
              </div>
            </div>
          )}

          {/* ── Stage: new (bulk form) ── */}
          {stage === "new" && (
            <div className="modal-form-group">
              {/* 공통 커트라인 — 모든 과제 일괄 적용 (모드 전환 직관화) */}
              <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)] px-3 py-2.5">
                <label className="text-sm font-semibold text-[var(--color-text-primary)] shrink-0" htmlFor="bulk-hw-cutline">
                  공통 커트라인
                </label>
                <input
                  id="bulk-hw-cutline"
                  type="number"
                  min={0}
                  className="ds-input"
                  style={{ width: 96 }}
                  value={rows[0]?.cutline ?? ""}
                  onChange={(e) => updateRow(rows[0].key, "cutline", e.target.value)}
                  aria-label="공통 커트라인"
                />
                <div
                  className="inline-flex rounded-md border border-[var(--color-border-divider)] overflow-hidden"
                  role="group"
                  aria-label="커트라인 기준"
                >
                  <button
                    type="button"
                    onClick={() => setCutlineMode("PERCENT")}
                    aria-pressed={cutlineMode === "PERCENT"}
                    className={`px-3 py-1 text-xs font-semibold ${
                      cutlineMode === "PERCENT"
                        ? "bg-[var(--color-brand-primary)] text-white"
                        : "bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-hover)]"
                    }`}
                  >
                    % (퍼센트)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCutlineMode("COUNT")}
                    aria-pressed={cutlineMode === "COUNT"}
                    className={`px-3 py-1 text-xs font-semibold border-l border-[var(--color-border-divider)] ${
                      cutlineMode === "COUNT"
                        ? "bg-[var(--color-brand-primary)] text-white"
                        : "bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-hover)]"
                    }`}
                  >
                    점 (점수)
                  </button>
                </div>
                <span className="text-xs text-[var(--color-text-muted)]">
                  아래 모든 과제에 동일하게 적용 · 미만 시 클리닉 보강 대상
                </span>
              </div>

              <table className="ds-table w-full" style={{ tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: 50 }} />
                  <col />
                  <col style={{ width: 80 }} />
                  <col style={{ width: 140 }} />
                  <col style={{ width: 32 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th className="text-center text-xs font-semibold" style={{ padding: "6px 4px" }}>순서</th>
                    <th className="text-left text-xs font-semibold" style={{ padding: "6px 8px" }}>제목</th>
                    <th className="text-left text-xs font-semibold" style={{ padding: "6px 8px" }}>만점</th>
                    <th className="text-left text-xs font-semibold" style={{ padding: "6px 8px" }}>제출기한</th>
                    <th style={{ padding: "6px 8px" }} />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={row.key}>
                      <td style={{ padding: "4px 4px", textAlign: "center" }}>
                        <div className="inline-flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => moveRow(row.key, "up")}
                            disabled={idx === 0}
                            className="text-base leading-none px-1 text-[var(--color-text-muted)] hover:text-[var(--color-brand-primary)] disabled:opacity-25 disabled:cursor-not-allowed"
                            aria-label={`${idx + 1}번 행 위로`}
                            title="위로"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            onClick={() => moveRow(row.key, "down")}
                            disabled={idx === rows.length - 1}
                            className="text-base leading-none px-1 text-[var(--color-text-muted)] hover:text-[var(--color-brand-primary)] disabled:opacity-25 disabled:cursor-not-allowed"
                            aria-label={`${idx + 1}번 행 아래로`}
                            title="아래로"
                          >
                            ▼
                          </button>
                        </div>
                      </td>
                      <td style={{ padding: "6px 8px", minWidth: 280 }}>
                        <input
                          className="ds-input w-full"
                          style={{ minHeight: 48, fontSize: 15, padding: "12px 14px", fontWeight: 500, letterSpacing: "-0.01em" }}
                          value={row.title}
                          onChange={(e) => updateRow(row.key, "title", e.target.value)}
                          placeholder={`${idx + 1}주차 과제 — 제목 입력`}
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
                <label className="modal-section-label">불러올 과제 선택 (이전에 만든 과제)</label>
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
                                <Badge key={lec.lecture_id}>{lec.lecture_title}</Badge>
                              ))}
                              {t.used_lectures!.length > 4 && <Badge>+{t.used_lectures!.length - 4}</Badge>}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <p className="modal-hint modal-hint--block mt-2">
                선택한 과제의 제목·양식이 그대로 적용됩니다. 원본을 고치면 이 차시에도 반영돼요.
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
                {submitting ? "만드는 중…" : `${rows.filter((r) => r.title.trim()).length}개 과제 만들기`}
              </Button>
            )}
            {stage === "import" && (
              <Button intent="primary" size="xl" onClick={handleImportSubmit} disabled={importDisabled}>
                {submitting ? "만드는 중…" : `${selectedTemplateIds.size}개 과제 가져오기`}
              </Button>
            )}
          </>
        }
      />
    </AdminModal>
  );
}
