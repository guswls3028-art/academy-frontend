// PATH: src/features/staff/pages/HomePage/WorkTypeCreateModal.tsx
// 시급태그 관리: 목록 조회 + 생성 + 수정 + 삭제

import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axios";

import {
  AdminModal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@/shared/ui/modal";
import { ActionButton } from "@/shared/ui/ds";
import { ColorPickerField } from "@/shared/ui/domain";
import { feedback } from "@/shared/ui/feedback/feedback";
import {
  fetchWorkTypes,
  updateWorkType,
  deleteWorkType,
  type WorkType,
} from "../../api/staffWorkType.api";

type FormData = {
  name: string;
  base_hourly_wage: number;
  color: string;
  description: string;
};

const EMPTY_FORM: FormData = {
  name: "",
  base_hourly_wage: 0,
  color: "#22c55e",
  description: "",
};

export default function WorkTypeCreateModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();

  // --- state ---
  const [view, setView] = useState<"list" | "create" | "edit">("list");
  const [editTarget, setEditTarget] = useState<WorkType | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);

  // reset on open
  useEffect(() => {
    if (open) {
      setView("list");
      setEditTarget(null);
      setForm(EMPTY_FORM);
    }
  }, [open]);

  // --- queries ---
  const workTypesQ = useQuery({
    queryKey: ["staffs", "work-types"],
    queryFn: () => fetchWorkTypes(),
    enabled: open,
  });
  const workTypes = workTypesQ.data ?? [];

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["work-types"] });
    qc.invalidateQueries({ queryKey: ["staffs", "work-types"] });
    qc.invalidateQueries({ queryKey: ["staffs"] });
  }, [qc]);

  // --- mutations ---
  const createM = useMutation({
    mutationFn: async () => {
      const res = await api.post("/staffs/work-types/", {
        name: form.name,
        base_hourly_wage: Number(form.base_hourly_wage),
        color: form.color,
        description: form.description,
      });
      return res.data;
    },
    onSuccess: () => {
      invalidate();
      feedback.success("시급태그가 생성되었습니다.");
      setView("list");
      setForm(EMPTY_FORM);
    },
    onError: (e: any) => {
      feedback.error(
        e?.response?.data?.detail ??
          e?.response?.data?.message ??
          "시급태그 생성 실패"
      );
    },
  });

  const updateM = useMutation({
    mutationFn: async () => {
      if (!editTarget) return;
      return updateWorkType(editTarget.id, {
        name: form.name,
        base_hourly_wage: Number(form.base_hourly_wage),
        color: form.color,
        description: form.description,
      });
    },
    onSuccess: () => {
      invalidate();
      feedback.success("시급태그가 수정되었습니다.");
      setView("list");
      setEditTarget(null);
      setForm(EMPTY_FORM);
    },
    onError: (e: any) => {
      feedback.error(
        e?.response?.data?.detail ??
          e?.response?.data?.message ??
          "시급태그 수정 실패"
      );
    },
  });

  const deleteM = useMutation({
    mutationFn: async (id: number) => deleteWorkType(id),
    onSuccess: () => {
      invalidate();
      feedback.success("시급태그가 삭제되었습니다.");
    },
    onError: (e: any) => {
      feedback.error(
        e?.response?.data?.detail ??
          e?.response?.data?.message ??
          "시급태그 삭제 실패"
      );
    },
  });

  // --- handlers ---
  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditTarget(null);
    setView("create");
  };

  const openEdit = (wt: WorkType) => {
    setEditTarget(wt);
    setForm({
      name: wt.name,
      base_hourly_wage: wt.base_hourly_wage,
      color: wt.color,
      description: wt.description,
    });
    setView("edit");
  };

  const handleSave = () => {
    if (!form.name.trim() || form.base_hourly_wage <= 0) {
      feedback.warning("필수 항목을 입력하세요.");
      return;
    }
    if (view === "edit") {
      updateM.mutate();
    } else {
      createM.mutate();
    }
  };

  const isSaving = createM.isPending || updateM.isPending;

  // ─── LIST VIEW ───
  if (view === "list") {
    return (
      <AdminModal open={open} onClose={onClose} type="action">
        <ModalHeader
          title="시급태그 관리"
          description="시급태그를 생성·수정·삭제할 수 있습니다."
          type="action"
        />
        <ModalBody>
          {workTypes.length === 0 ? (
            <div className="py-6 text-center text-sm text-[var(--text-muted)]">
              등록된 시급태그가 없습니다.
            </div>
          ) : (
            <div className="grid gap-2">
              {workTypes.map((wt) => (
                <div
                  key={wt.id}
                  className="flex items-center gap-3 rounded-lg border border-[var(--border-divider)] px-3 py-2.5 bg-[var(--bg-app)] hover:bg-[var(--bg-surface-hover)] transition-colors"
                >
                  <span
                    className="inline-block h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: wt.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{wt.name}</div>
                    {wt.description && (
                      <div className="text-xs text-[var(--text-muted)] truncate">
                        {wt.description}
                      </div>
                    )}
                  </div>
                  <div className="text-sm font-medium text-[var(--text-secondary)] whitespace-nowrap">
                    {Number(wt.base_hourly_wage).toLocaleString()}원
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      className="ds-button"
                      data-intent="secondary"
                      data-size="xs"
                      onClick={() => openEdit(wt)}
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      className="ds-button"
                      data-intent="danger"
                      data-size="xs"
                      disabled={deleteM.isPending}
                      onClick={() => {
                        if (!window.confirm(`"${wt.name}" 시급태그를 삭제하시겠습니까?`)) return;
                        deleteM.mutate(wt.id);
                      }}
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ModalBody>
        <ModalFooter
          right={
            <>
              <ActionButton action="close" onClick={onClose} />
              <ActionButton action="create" onClick={openCreate}>
                새 시급태그
              </ActionButton>
            </>
          }
        />
      </AdminModal>
    );
  }

  // ─── CREATE / EDIT VIEW ───
  const isEdit = view === "edit";

  return (
    <AdminModal
      open={open}
      onClose={() => setView("list")}
      type="action"
      onEnterConfirm={() => {
        if (!isSaving) handleSave();
      }}
    >
      <ModalHeader
        title={isEdit ? "시급태그 수정" : "시급태그 생성"}
        description={
          isEdit
            ? "시급태그 정보를 수정합니다."
            : "직원 시급태그로 사용할 유형을 추가합니다."
        }
        type="action"
      />

      <ModalBody>
        <div className="grid gap-3">
          <Field label="시급태그명 *">
            <input
              className="ds-input"
              value={form.name}
              onChange={(e) =>
                setForm((p) => ({ ...p, name: e.target.value }))
              }
            />
          </Field>

          <Field label="기본 시급(원) *">
            <input
              type="number"
              className="ds-input"
              value={form.base_hourly_wage}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  base_hourly_wage: Number(e.target.value),
                }))
              }
            />
          </Field>

          <Field label="색상">
            <ColorPickerField
              value={form.color}
              onChange={(color) =>
                setForm((p) => ({ ...p, color: color ?? p.color }))
              }
            />
          </Field>

          <Field label="설명">
            <textarea
              className="ds-input"
              rows={2}
              value={form.description}
              onChange={(e) =>
                setForm((p) => ({ ...p, description: e.target.value }))
              }
            />
          </Field>
        </div>
      </ModalBody>

      <ModalFooter
        right={
          <>
            <ActionButton action="close" onClick={() => setView("list")}>
              목록으로
            </ActionButton>
            <ActionButton
              action={isEdit ? "save" : "create"}
              loading={isSaving}
              onClick={handleSave}
            >
              {isEdit ? "저장" : "생성"}
            </ActionButton>
          </>
        }
      />
    </AdminModal>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1">
      <div className="text-xs font-semibold text-[var(--text-muted)]">
        {label}
      </div>
      {children}
    </div>
  );
}
