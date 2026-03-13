// PATH: src/features/homework/components/CreateHomeworkModal.tsx
// ------------------------------------------------------------
// 과제 생성 모달 — 제목 → 생성 → 설정(커트라인) → 연속 생성 가능
// 대상자 자동 등록, 여러 과제 연속 생성 지원
// ------------------------------------------------------------

import { useEffect, useState, useMemo } from "react";
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

type Stage = "choose" | "new" | "import" | "setup";

export default function CreateHomeworkModal({
  open,
  onClose,
  sessionId,
  onCreated,
}: Props) {
  const [stage, setStage] = useState<Stage>("choose");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [templates, setTemplates] = useState<HomeworkTemplateWithUsage[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [keyword, setKeyword] = useState("");

  // post-creation setup
  const [createdHomeworkId, setCreatedHomeworkId] = useState<number | null>(null);
  const [cutlineValue, setCutlineValue] = useState("80");
  const [cutlineMode, setCutlineMode] = useState<"PERCENT" | "COUNT">("PERCENT");
  const [savingSetup, setSavingSetup] = useState(false);
  const [policyId, setPolicyId] = useState<number | null>(null);

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
    setCreatedHomeworkId(null);
    setCutlineValue("80");
    setCutlineMode("PERCENT");
    setSavingSetup(false);
    setPolicyId(null);
    setCreatedCount(0);
    setLastStage("new");
  }, [open]);

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

  // Load existing policy when entering setup
  useEffect(() => {
    if (stage !== "setup" || !sessionId) return;
    let cancelled = false;
    fetchHomeworkPolicyBySession(sessionId).then((policy) => {
      if (cancelled || !policy) return;
      setPolicyId(policy.id);
      setCutlineMode(policy.cutline_mode);
      setCutlineValue(String(policy.cutline_value));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [stage, sessionId]);

  const autoEnroll = async (homeworkId: number) => {
    try {
      const enrollments = await fetchSessionEnrollments(sessionId);
      const ids = enrollments.map((e) => e.enrollment);
      if (ids.length > 0) {
        await putHomeworkAssignments({ homeworkId, enrollment_ids: ids });
      }
    } catch {
      // silent — enrollment is best-effort during creation
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
      setError("과제 제목을 입력하세요.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const payload: { session_id: number; title: string; template_homework_id?: number } = {
        session_id: sessionId,
        title: title.trim(),
      };
      if (stage === "import" && selectedTemplateId) payload.template_homework_id = selectedTemplateId;
      const res = await api.post("/homeworks/", payload);
      const newId = Number(res.data?.id ?? res.data?.homework_id ?? res.data?.pk);
      if (!Number.isFinite(newId) || newId <= 0) throw new Error("생성 후 ID를 받지 못했습니다.");

      // Auto-enroll students
      void autoEnroll(newId);

      setCreatedHomeworkId(newId);
      setLastStage(stage === "import" ? "import" : "new");
      setCreatedCount((c) => c + 1);
      onCreated(newId);
      setStage("setup");
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? "과제 생성 실패.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveSetup = async () => {
    if (!policyId) {
      onClose();
      return;
    }
    setSavingSetup(true);
    try {
      const cv = Number(cutlineValue);
      await patchHomeworkPolicy(policyId, {
        cutline_mode: cutlineMode,
        cutline_value: Number.isFinite(cv) && cv >= 0 ? cv : 80,
      });
      feedback.success(`"${title}" 커트라인 저장 완료`);
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? "설정 저장 실패");
    } finally {
      setSavingSetup(false);
    }
  };

  const handleSaveAndContinue = async () => {
    if (policyId) {
      setSavingSetup(true);
      try {
        const cv = Number(cutlineValue);
        await patchHomeworkPolicy(policyId, {
          cutline_mode: cutlineMode,
          cutline_value: Number.isFinite(cv) && cv >= 0 ? cv : 80,
        });
        feedback.success(`"${title}" 저장 완료 (${createdCount}번째)`);
      } catch (e: any) {
        setError(e?.response?.data?.detail ?? e?.message ?? "설정 저장 실패");
        setSavingSetup(false);
        return;
      }
      setSavingSetup(false);
    } else {
      feedback.success(`"${title}" 생성 완료 (${createdCount}번째)`);
    }
    // Reset for next creation
    setTitle("");
    setSelectedTemplateId(null);
    setCreatedHomeworkId(null);
    setCutlineValue("80");
    setCutlineMode("PERCENT");
    setError(null);
    setStage(lastStage);
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
    ) : stage === "setup" ? (
      <span>
        과제 설정
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
          onClick={() => { setError(null); setStage("choose"); }}
          className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          aria-label="뒤로"
        >
          ←
        </button>
        <span>
          {stage === "new" ? "신규 과제" : "불러오기"}
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
            ? "신규 과제를 만들거나, 기존 템플릿을 불러와 이 차시에 적용할 수 있습니다. 대상자는 자동 등록됩니다."
            : stage === "setup"
            ? `"${title}" 과제가 생성되었습니다. 커트라인을 설정하세요.`
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
                  onClick={() => { setError(null); setTitle(""); setSelectedTemplateId(null); setStage("new"); }}
                />
                <SessionBlockView
                  variant="supplement"
                  compact={false}
                  selected={false}
                  showCheck
                  title="불러오기"
                  desc="다른 강의의 과제 템플릿을 불러옵니다."
                  onClick={() => { setError(null); setKeyword(""); setSelectedTemplateId(null); setStage("import"); }}
                />
              </div>
              {createdCount > 0 && (
                <p className="mt-3 text-sm text-[var(--color-brand-primary)] font-semibold">
                  {createdCount}개 과제가 생성되었습니다.
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

          {/* ── Stage: new / import → title ── */}
          {(stage === "new" || stage === "import") && (
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
              {stage === "import" && selectedTemplate && (
                <p className="modal-hint modal-hint--block">템플릿: {selectedTemplate.title}</p>
              )}
            </div>
          )}

          {/* ── Stage: setup (post-creation) ── */}
          {stage === "setup" && (
            <div className="space-y-5">
              <div className="modal-form-group">
                <div className="modal-section-label mb-2">커트라인</div>
                <div className="flex items-center gap-4">
                  <div>
                    <div className="mb-1 text-xs text-[var(--color-text-muted)]">기준</div>
                    <select
                      className="ds-input"
                      style={{ width: 120 }}
                      value={cutlineMode}
                      onChange={(e) => setCutlineMode(e.target.value as "PERCENT" | "COUNT")}
                    >
                      <option value="PERCENT">퍼센트 (%)</option>
                      <option value="COUNT">문항수 (점)</option>
                    </select>
                  </div>
                  <div>
                    <div className="mb-1 text-xs text-[var(--color-text-muted)]">
                      {cutlineMode === "PERCENT" ? "커트라인 (%)" : "커트라인 (점)"}
                    </div>
                    <input
                      type="number"
                      min={0}
                      className="ds-input"
                      style={{ width: 120 }}
                      value={cutlineValue}
                      onChange={(e) => setCutlineValue(e.target.value)}
                      placeholder={cutlineMode === "PERCENT" ? "80" : "40"}
                      autoFocus
                    />
                  </div>
                </div>
                {!policyId && (
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    과제 정책이 아직 생성되지 않았습니다. 과제 설정에서 커트라인을 조정할 수 있습니다.
                  </p>
                )}
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
