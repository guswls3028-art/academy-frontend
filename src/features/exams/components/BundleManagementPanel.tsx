/**
 * BundleManagementPanel
 *
 * 시험/과제 템플릿 묶음 관리 패널.
 * 묶음 생성, 수정, 삭제 + 묶음 내 항목 편집.
 */

import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Package, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/shared/ui/ds";
import { AdminModal, ModalHeader, ModalBody, ModalFooter, MODAL_WIDTH } from "@/shared/ui/modal";
import { useConfirm } from "@/shared/ui/confirm";
import { feedback } from "@/shared/ui/feedback/feedback";
import {
  fetchBundles,
  createBundle,
  updateBundle,
  deleteBundle,
  type TemplateBundle,
  type BundleItemInput,
} from "../api/templateBundles";
import { fetchTemplatesWithUsage, type TemplateWithUsage } from "../api/templatesWithUsage";
import { fetchHomeworkTemplatesWithUsage, type HomeworkTemplateWithUsage } from "@/features/homework/api/adminHomework";

export default function BundleManagementPanel() {
  const qc = useQueryClient();
  const confirm = useConfirm();

  const { data: bundles = [], isLoading } = useQuery({
    queryKey: ["template-bundles"],
    queryFn: fetchBundles,
  });

  const [editModal, setEditModal] = useState<{ open: boolean; bundle: TemplateBundle | null }>({
    open: false,
    bundle: null,
  });

  const handleDelete = async (bundle: TemplateBundle) => {
    const ok = await confirm({
      title: "묶음 삭제",
      message: `"${bundle.name}" 묶음을 삭제하시겠습니까?`,
      confirmText: "삭제",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteBundle(bundle.id);
      qc.invalidateQueries({ queryKey: ["template-bundles"] });
      feedback.success("묶음이 삭제되었습니다.");
    } catch {
      feedback.error("묶음 삭제에 실패했습니다.");
    }
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 p-4">
        {[1, 2].map((i) => (
          <div key={i} className="h-24 rounded-lg bg-[var(--color-bg-skeleton)] animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-text-secondary)]">
          시험/과제 템플릿을 묶음으로 저장하여 차시에 일괄 적용할 수 있습니다.
        </h3>
        <Button
          intent="primary"
          size="sm"
          onClick={() => setEditModal({ open: true, bundle: null })}
        >
          <Plus size={14} />
          묶음 만들기
        </Button>
      </div>

      {bundles.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-8 text-[var(--color-text-muted)]">
          <Package size={32} />
          <div className="text-sm font-semibold">등록된 묶음이 없습니다</div>
          <div className="text-xs">자주 사용하는 시험/과제 템플릿 조합을 묶음으로 저장하세요.</div>
        </div>
      )}

      <div className="grid gap-3">
        {bundles.map((bundle) => (
          <div
            key={bundle.id}
            className="rounded-lg border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Package size={16} className="text-[var(--color-brand-primary)] flex-shrink-0" />
                  <h4 className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                    {bundle.name}
                  </h4>
                </div>
                {bundle.description && (
                  <p className="mt-1 text-xs text-[var(--color-text-muted)] ml-6">{bundle.description}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-2 ml-6">
                  {bundle.exam_count > 0 && (
                    <span className="ds-badge">시험 {bundle.exam_count}개</span>
                  )}
                  {bundle.homework_count > 0 && (
                    <span className="ds-badge">과제 {bundle.homework_count}개</span>
                  )}
                </div>
                {bundle.items.length > 0 && (
                  <div className="mt-2 ml-6 flex flex-wrap gap-1.5">
                    {bundle.items.map((item) => (
                      <span
                        key={item.id}
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium border border-[var(--color-border-divider)] text-[var(--color-text-secondary)] bg-[var(--color-bg-surface-soft)]"
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${item.item_type === "exam" ? "bg-blue-500" : "bg-emerald-500"}`} />
                        {item.title_override || item.template_title || "-"}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setEditModal({ open: true, bundle })}
                  className="p-1.5 rounded hover:bg-[var(--color-bg-surface-soft)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                  aria-label="수정"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(bundle)}
                  className="p-1.5 rounded hover:bg-[var(--color-bg-surface-soft)] text-[var(--color-text-muted)] hover:text-[var(--color-error)]"
                  aria-label="삭제"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <BundleEditModal
        open={editModal.open}
        bundle={editModal.bundle}
        onClose={() => setEditModal({ open: false, bundle: null })}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["template-bundles"] });
          setEditModal({ open: false, bundle: null });
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  BundleEditModal                                                    */
/* ------------------------------------------------------------------ */

type EditProps = {
  open: boolean;
  bundle: TemplateBundle | null;
  onClose: () => void;
  onSaved: () => void;
};

function BundleEditModal({ open, bundle, onClose, onSaved }: EditProps) {
  const isEdit = bundle != null;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<BundleItemInput[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Template lists
  const [examTemplates, setExamTemplates] = useState<TemplateWithUsage[]>([]);
  const [hwTemplates, setHwTemplates] = useState<HomeworkTemplateWithUsage[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const [keyword, setKeyword] = useState("");
  const [addTab, setAddTab] = useState<"exam" | "homework">("exam");

  useEffect(() => {
    if (!open) return;
    setName(bundle?.name ?? "");
    setDescription(bundle?.description ?? "");
    setItems(
      bundle?.items.map((item) => ({
        item_type: item.item_type,
        exam_template_id: item.exam_template ?? undefined,
        homework_template_id: item.homework_template ?? undefined,
        title_override: item.title_override,
        display_order: item.display_order,
        config: item.config ?? undefined,
      })) ?? []
    );
    setError(null);
    setKeyword("");
    setAddTab("exam");

    // Load templates
    let cancelled = false;
    setLoadingTemplates(true);
    Promise.all([
      fetchTemplatesWithUsage().catch(() => []),
      fetchHomeworkTemplatesWithUsage().catch(() => []),
    ]).then(([exams, hws]) => {
      if (cancelled) return;
      setExamTemplates(exams ?? []);
      setHwTemplates(hws ?? []);
      setLoadingTemplates(false);
    });
    return () => { cancelled = true; };
  }, [open, bundle]);

  const selectedExamIds = useMemo(
    () => new Set(items.filter((i) => i.item_type === "exam").map((i) => i.exam_template_id)),
    [items]
  );
  const selectedHwIds = useMemo(
    () => new Set(items.filter((i) => i.item_type === "homework").map((i) => i.homework_template_id)),
    [items]
  );

  const filteredExamTemplates = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    if (!k) return examTemplates;
    return examTemplates.filter(
      (t) => (t.title ?? "").toLowerCase().includes(k) || (t.subject ?? "").toLowerCase().includes(k)
    );
  }, [examTemplates, keyword]);

  const filteredHwTemplates = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    if (!k) return hwTemplates;
    return hwTemplates.filter((t) => (t.title ?? "").toLowerCase().includes(k));
  }, [hwTemplates, keyword]);

  const toggleExam = (tpl: TemplateWithUsage) => {
    if (selectedExamIds.has(tpl.id)) {
      setItems((prev) => prev.filter((i) => !(i.item_type === "exam" && i.exam_template_id === tpl.id)));
    } else {
      setItems((prev) => [
        ...prev,
        {
          item_type: "exam",
          exam_template_id: tpl.id,
          title_override: "",
          display_order: prev.length,
        },
      ]);
    }
  };

  const toggleHomework = (tpl: HomeworkTemplateWithUsage) => {
    if (selectedHwIds.has(tpl.id)) {
      setItems((prev) => prev.filter((i) => !(i.item_type === "homework" && i.homework_template_id === tpl.id)));
    } else {
      setItems((prev) => [
        ...prev,
        {
          item_type: "homework",
          homework_template_id: tpl.id,
          title_override: "",
          display_order: prev.length,
        },
      ]);
    }
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const getItemLabel = (item: BundleItemInput): string => {
    if (item.item_type === "exam") {
      const tpl = examTemplates.find((t) => t.id === item.exam_template_id);
      return item.title_override || tpl?.title || `시험 #${item.exam_template_id}`;
    }
    const tpl = hwTemplates.find((t) => t.id === item.homework_template_id);
    return item.title_override || tpl?.title || `과제 #${item.homework_template_id}`;
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("묶음 이름을 입력하세요.");
      return;
    }
    if (items.length === 0) {
      setError("시험 또는 과제 템플릿을 하나 이상 추가하세요.");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const data = { name: name.trim(), description: description.trim(), items };
      if (isEdit) {
        await updateBundle(bundle!.id, data);
        feedback.success("묶음이 수정되었습니다.");
      } else {
        await createBundle(data);
        feedback.success("묶음이 생성되었습니다.");
      }
      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? "저장에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <AdminModal open onClose={onClose} type="action" width={MODAL_WIDTH.wide}>
      <ModalHeader
        type="action"
        title={isEdit ? "묶음 수정" : "묶음 만들기"}
        description="시험/과제 템플릿을 선택하여 묶음을 구성합니다."
      />
      <ModalBody>
        <div className="modal-scroll-body space-y-4">
          {error && (
            <div className="modal-hint modal-hint--block" style={{ color: "var(--color-error)", fontWeight: 700 }}>
              {error}
            </div>
          )}

          {/* Name + Description */}
          <div className="modal-form-group">
            <label className="modal-section-label">묶음 이름</label>
            <input
              className="ds-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예) 수학 기본 세트"
              autoFocus
            />
          </div>
          <div className="modal-form-group">
            <label className="modal-section-label">설명 (선택)</label>
            <input
              className="ds-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="예) 단원평가 + 숙제 3종"
            />
          </div>

          {/* Selected items */}
          <div className="modal-form-group">
            <label className="modal-section-label">선택된 항목 ({items.length})</label>
            {items.length === 0 ? (
              <div className="text-sm text-[var(--color-text-muted)] py-2">
                아래에서 시험/과제 템플릿을 선택하세요.
              </div>
            ) : (
              <div className="space-y-1.5">
                {items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 rounded border border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)] px-3 py-1.5"
                  >
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${item.item_type === "exam" ? "bg-blue-500" : "bg-emerald-500"}`} />
                    <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase w-8">
                      {item.item_type === "exam" ? "시험" : "과제"}
                    </span>
                    <span className="text-sm text-[var(--color-text-primary)] flex-1 truncate">
                      {getItemLabel(item)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="text-[var(--color-text-muted)] hover:text-[var(--color-error)] text-lg leading-none"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Template selector */}
          <div className="modal-form-group">
            <label className="modal-section-label">템플릿 추가</label>
            <div className="rounded border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] overflow-hidden">
              {/* Tabs */}
              <div className="flex border-b border-[var(--color-border-divider)]">
                <button
                  type="button"
                  onClick={() => setAddTab("exam")}
                  className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                    addTab === "exam"
                      ? "text-[var(--color-brand-primary)] border-b-2 border-[var(--color-brand-primary)]"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  시험 템플릿
                </button>
                <button
                  type="button"
                  onClick={() => setAddTab("homework")}
                  className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                    addTab === "homework"
                      ? "text-[var(--color-brand-primary)] border-b-2 border-[var(--color-brand-primary)]"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  과제 템플릿
                </button>
              </div>

              <div className="p-3 space-y-2">
                <input
                  className="ds-input"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="검색..."
                />

                {loadingTemplates && <div className="text-sm text-[var(--color-text-muted)]">불러오는 중…</div>}

                {!loadingTemplates && (
                  <div className="grid gap-1.5" style={{ maxHeight: 200, overflowY: "auto" }}>
                    {addTab === "exam" && filteredExamTemplates.map((t) => {
                      const checked = selectedExamIds.has(t.id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => toggleExam(t)}
                          className={`w-full text-left rounded border px-3 py-1.5 transition-colors flex items-center gap-2 ${
                            checked
                              ? "border-[var(--color-brand-primary)] bg-[var(--state-selected-bg)]"
                              : "border-[var(--color-border-divider)] hover:bg-[var(--color-bg-surface-soft)]"
                          }`}
                        >
                          <input type="checkbox" checked={checked} readOnly className="accent-[var(--color-brand-primary)] pointer-events-none" tabIndex={-1} />
                          <span className="text-sm truncate">{t.title}</span>
                          {t.subject && <span className="text-[10px] text-[var(--color-text-muted)] ml-auto">{t.subject}</span>}
                        </button>
                      );
                    })}
                    {addTab === "homework" && filteredHwTemplates.map((t) => {
                      const checked = selectedHwIds.has(t.id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => toggleHomework(t)}
                          className={`w-full text-left rounded border px-3 py-1.5 transition-colors flex items-center gap-2 ${
                            checked
                              ? "border-[var(--color-brand-primary)] bg-[var(--state-selected-bg)]"
                              : "border-[var(--color-border-divider)] hover:bg-[var(--color-bg-surface-soft)]"
                          }`}
                        >
                          <input type="checkbox" checked={checked} readOnly className="accent-[var(--color-brand-primary)] pointer-events-none" tabIndex={-1} />
                          <span className="text-sm truncate">{t.title}</span>
                        </button>
                      );
                    })}
                    {addTab === "exam" && filteredExamTemplates.length === 0 && (
                      <div className="text-sm text-[var(--color-text-muted)] py-2">시험 템플릿이 없습니다.</div>
                    )}
                    {addTab === "homework" && filteredHwTemplates.length === 0 && (
                      <div className="text-sm text-[var(--color-text-muted)] py-2">과제 템플릿이 없습니다.</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </ModalBody>
      <ModalFooter
        right={
          <>
            <Button intent="secondary" size="xl" onClick={onClose} disabled={submitting}>
              취소
            </Button>
            <Button intent="primary" size="xl" onClick={handleSubmit} disabled={submitting || !name.trim() || items.length === 0}>
              {submitting ? "저장 중…" : isEdit ? "수정" : "만들기"}
            </Button>
          </>
        }
      />
    </AdminModal>
  );
}
