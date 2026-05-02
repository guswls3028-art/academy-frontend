/* eslint-disable no-restricted-syntax, @typescript-eslint/no-explicit-any */
// PATH: src/app_teacher/domains/exams/pages/ExamBundlesPage.tsx
// 시험 번들 — 여러 시험/과제 템플릿을 묶어 차시에 일괄 적용하는 CRUD
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { ChevronLeft, Plus, Pencil, Trash2, X, FolderPlus } from "@teacher/shared/ui/Icons";
import { Card, TabBar } from "@teacher/shared/ui/Card";
import { Badge } from "@teacher/shared/ui/Badge";
import BottomSheet from "@teacher/shared/ui/BottomSheet";
import { teacherToast } from "@teacher/shared/ui/teacherToast";
import { extractApiError } from "@/shared/utils/extractApiError";
import {
  fetchBundles, fetchBundle, createBundle, updateBundle, deleteBundle,
  fetchTemplatesWithUsage, fetchHomeworkTemplatesWithUsage,
  type ExamBundle,
} from "../api";

export default function ExamBundlesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ExamBundle | null>(null);

  const { data: bundles, isLoading } = useQuery({
    queryKey: ["teacher-exam-bundles"],
    queryFn: fetchBundles,
  });

  const deleteMut = useMutation({
    mutationFn: deleteBundle,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-exam-bundles"] });
      teacherToast.success("번들이 삭제되었습니다.");
    },
    onError: (e) => teacherToast.error(extractApiError(e, "번들을 삭제하지 못했습니다.")),
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 py-0.5">
        <button onClick={() => navigate(-1)} className="flex p-1 cursor-pointer"
          style={{ background: "none", border: "none", color: "var(--tc-text-secondary)" }}>
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-[17px] font-bold flex-1" style={{ color: "var(--tc-text)" }}>시험 번들</h1>
        <button onClick={() => { setEditTarget(null); setFormOpen(true); }}
          className="flex items-center gap-1 text-xs font-bold cursor-pointer"
          style={{ padding: "6px 12px", borderRadius: "var(--tc-radius)", border: "none", background: "var(--tc-primary)", color: "#fff" }}>
          <Plus size={14} /> 새 번들
        </button>
      </div>

      <div className="text-[11px] px-1" style={{ color: "var(--tc-text-muted)", lineHeight: 1.5 }}>
        번들은 여러 시험·과제 템플릿을 한 묶음으로 저장한 뒤 차시에 일괄 적용할 때 사용합니다.
      </div>

      {isLoading ? <EmptyState scope="panel" tone="loading" title="불러오는 중…" /> :
        bundles && bundles.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {bundles.map((b) => (
              <Card key={b.id} style={{ padding: "var(--tc-space-3) var(--tc-space-4)" }}>
                <div className="flex items-start gap-2">
                  <FolderPlus size={15} style={{ color: "var(--tc-primary)", flexShrink: 0, marginTop: 2 }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold" style={{ color: "var(--tc-text)" }}>{b.name}</div>
                    {b.description && <div className="text-[11px] mt-0.5" style={{ color: "var(--tc-text-muted)" }}>{b.description}</div>}
                    <div className="text-[11px] mt-1" style={{ color: "var(--tc-text-muted)" }}>
                      항목 {b.item_count ?? b.items?.length ?? 0}개
                    </div>
                  </div>
                  <div className="flex gap-0.5 shrink-0">
                    <button onClick={() => { setEditTarget(b); setFormOpen(true); }} className="flex p-1.5 cursor-pointer"
                      style={{ background: "none", border: "none", color: "var(--tc-text-muted)" }}>
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => { if (confirm(`'${b.name}' 번들을 삭제하시겠습니까?`)) deleteMut.mutate(b.id); }}
                      className="flex p-1.5 cursor-pointer"
                      style={{ background: "none", border: "none", color: "var(--tc-danger)" }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : <EmptyState scope="panel" tone="empty" title="번들이 없습니다" />}

      <BundleFormSheet open={formOpen} onClose={() => { setFormOpen(false); setEditTarget(null); }} editData={editTarget} />
    </div>
  );
}

/* ─── Bundle Form Sheet ─── */
type BundleItem = { kind: "exam" | "homework"; template_id: number; title?: string };

function BundleFormSheet({ open, onClose, editData }: {
  open: boolean; onClose: () => void; editData: ExamBundle | null;
}) {
  const qc = useQueryClient();
  const isEdit = !!editData;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<BundleItem[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Load full bundle when editing
  const { data: fullBundle } = useQuery({
    queryKey: ["teacher-exam-bundle", editData?.id],
    queryFn: () => fetchBundle(editData!.id),
    enabled: open && isEdit,
  });

  useEffect(() => {
    if (!open) return;
    if (isEdit && fullBundle) {
      setName(fullBundle.name ?? "");
      setDescription(fullBundle.description ?? "");
      setItems((fullBundle.items ?? []).map((it: any) => ({
        kind: it.kind ?? "exam",
        template_id: it.template_id ?? it.exam_template_id ?? it.homework_template_id,
        title: it.title ?? it.template_title,
      })));
    } else if (!isEdit) {
      setName(""); setDescription(""); setItems([]);
    }
  }, [open, isEdit, fullBundle]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload = { name: name.trim(), description: description.trim() || undefined, items };
      return isEdit ? updateBundle(editData!.id, payload) : createBundle(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-exam-bundles"] });
      teacherToast.success(isEdit ? "수정되었습니다." : "번들이 생성되었습니다.");
      onClose();
    },
    onError: () => teacherToast.error("저장에 실패했습니다."),
  });

  return (
    <BottomSheet open={open} onClose={onClose} title={isEdit ? "번들 편집" : "번들 생성"}>
      <div className="flex flex-col gap-2.5" style={{ padding: "var(--tc-space-3) 0" }}>
        <Fld label="번들 이름 *" value={name} onChange={setName} placeholder="예: 1학기 중간고사 세트" />
        <Fld label="설명" value={description} onChange={setDescription} placeholder="번들 설명 (선택)" />

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[11px] font-semibold" style={{ color: "var(--tc-text-muted)" }}>포함된 항목 ({items.length})</label>
            <button onClick={() => setPickerOpen(true)} type="button"
              className="flex items-center gap-0.5 text-[11px] font-semibold cursor-pointer"
              style={{ padding: "3px 8px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-primary)", background: "var(--tc-primary-bg)", color: "var(--tc-primary)" }}>
              <Plus size={11} /> 템플릿 추가
            </button>
          </div>
          {items.length === 0 ? (
            <div className="text-[12px] py-3 text-center" style={{ color: "var(--tc-text-muted)", borderRadius: "var(--tc-radius-sm)", background: "var(--tc-surface-soft)" }}>
              항목을 추가하세요
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {items.map((it, i) => (
                <div key={i} className="flex items-center gap-2"
                  style={{ padding: "6px 10px", borderRadius: "var(--tc-radius-sm)", background: "var(--tc-surface-soft)" }}>
                  <Badge tone={it.kind === "exam" ? "primary" : "info"} size="xs">{it.kind === "exam" ? "시험" : "과제"}</Badge>
                  <span className="text-[13px] flex-1 truncate" style={{ color: "var(--tc-text)" }}>{it.title ?? `#${it.template_id}`}</span>
                  <button onClick={() => setItems(items.filter((_, idx) => idx !== i))}
                    className="flex p-0.5 cursor-pointer" style={{ background: "none", border: "none", color: "var(--tc-text-muted)" }}>
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button onClick={() => mutation.mutate()} disabled={!name.trim() || mutation.isPending}
          className="w-full text-sm font-bold cursor-pointer mt-1"
          style={{ padding: "12px", borderRadius: "var(--tc-radius)", border: "none", background: name.trim() ? "var(--tc-primary)" : "var(--tc-surface-soft)", color: name.trim() ? "#fff" : "var(--tc-text-muted)" }}>
          {mutation.isPending ? "저장 중…" : isEdit ? "수정" : "생성"}
        </button>
      </div>

      <TemplatePickerSheet open={pickerOpen} onClose={() => setPickerOpen(false)}
        onPick={(it) => {
          if (items.some(i => i.kind === it.kind && i.template_id === it.template_id)) {
            teacherToast.info("이미 추가된 항목입니다.");
            return;
          }
          setItems([...items, it]);
          setPickerOpen(false);
        }} />
    </BottomSheet>
  );
}

/* ─── Template Picker Sheet ─── */
function TemplatePickerSheet({ open, onClose, onPick }: {
  open: boolean; onClose: () => void; onPick: (it: BundleItem) => void;
}) {
  const [pickerTab, setPickerTab] = useState<"exam" | "homework">("exam");
  const { data: exams } = useQuery({
    queryKey: ["teacher-exam-templates-usage"],
    queryFn: fetchTemplatesWithUsage,
    enabled: open && pickerTab === "exam",
  });
  const { data: homeworks } = useQuery({
    queryKey: ["teacher-homework-templates-usage"],
    queryFn: fetchHomeworkTemplatesWithUsage,
    enabled: open && pickerTab === "homework",
  });

  const list = pickerTab === "exam" ? exams : homeworks;

  return (
    <BottomSheet open={open} onClose={onClose} title="템플릿 선택">
      <div className="flex flex-col gap-2.5" style={{ padding: "var(--tc-space-3) 0" }}>
        <TabBar
          tabs={[
            { key: "exam" as const, label: "시험" },
            { key: "homework" as const, label: "과제" },
          ]}
          value={pickerTab}
          onChange={setPickerTab}
        />
        {list && list.length > 0 ? (
          <div className="flex flex-col gap-1">
            {list.map((t: any) => (
              <button key={t.id} onClick={() => onPick({ kind: pickerTab, template_id: t.id, title: t.title ?? t.name })}
                type="button"
                className="text-left cursor-pointer"
                style={{ padding: "10px 12px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border)", background: "var(--tc-surface)" }}>
                <div className="text-sm font-semibold" style={{ color: "var(--tc-text)" }}>{t.title ?? t.name}</div>
                {(t.subject ?? t.category) && (
                  <div className="text-[11px] mt-0.5" style={{ color: "var(--tc-text-muted)" }}>{t.subject ?? t.category}</div>
                )}
              </button>
            ))}
          </div>
        ) : <EmptyState scope="panel" tone="empty" title="템플릿이 없습니다" />}
      </div>
    </BottomSheet>
  );
}

function Fld({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full text-sm"
        style={{ padding: "8px 10px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface-soft)", color: "var(--tc-text)", outline: "none" }} />
    </div>
  );
}
