// PATH: src/features/homework/components/CreateHomeworkModal.tsx
// ------------------------------------------------------------
// CreateHomeworkModal — 시험 CreateRegularExamModal과 동일: 신규 / 불러오기(템플릿)
// ------------------------------------------------------------

import { useEffect, useState, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import { AdminModal, ModalHeader, ModalBody, ModalFooter, MODAL_WIDTH } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { SessionBlockView } from "@/shared/ui/session-block";
import { createHomework } from "../api/homeworks";
import { fetchHomeworkTemplatesWithUsage, type HomeworkTemplateWithUsage } from "../api/adminHomework";

type Props = {
  open: boolean;
  onClose: () => void;
  sessionId: number;
  onCreated: (newId: number) => void;
};

type Stage = "choose" | "new" | "import";

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
      onCreated(newId);
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? "과제 생성 실패.");
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
        <span>{stage === "new" ? "신규 과제" : "불러오기"}</span>
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
            ? "신규 과제를 만들거나, 기존 템플릿을 불러와 이 차시에 적용할 수 있습니다. 다른 강의에서도 사용 가능하며, 여러 강의의 통계를 합산해 볼 수 있습니다."
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
            </div>
          )}

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
                  <div className="grid gap-2">
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

          {stage !== "choose" && (
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
        </div>
      </ModalBody>

      <ModalFooter
        right={
          <>
            <Button intent="secondary" size="xl" onClick={onClose} disabled={submitting}>
              취소
            </Button>
            {stage !== "choose" && (
              <Button intent="primary" size="xl" onClick={handleSubmit} disabled={disabled}>
                {submitting ? "생성 중…" : "생성"}
              </Button>
            )}
          </>
        }
      />
    </AdminModal>
  );
}
