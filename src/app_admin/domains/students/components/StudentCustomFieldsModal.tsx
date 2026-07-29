import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createStudentCustomField,
  deactivateStudentCustomField,
  fetchStudentCustomFields,
  updateStudentCustomField,
  type ClientStudentCustomFieldDefinition,
  type StudentCustomFieldType,
} from "../api/students.api";
import { adminStudentsQueryKeys } from "../queryKeys";
import { Button, EmptyState } from "@/shared/ui/ds";
import { getApiErrorMessage } from "@/shared/api/errorMessage";
import { feedback } from "@/shared/ui/feedback/feedback";
import {
  AdminModal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  MODAL_WIDTH,
} from "@/shared/ui/modal";

type Props = {
  open: boolean;
  onClose: () => void;
};

type EditorState = {
  label: string;
  fieldType: StudentCustomFieldType;
  aliases: string;
  options: string;
};

const EMPTY_EDITOR: EditorState = {
  label: "",
  fieldType: "text",
  aliases: "",
  options: "",
};

const FIELD_TYPE_LABELS: Record<StudentCustomFieldType, string> = {
  text: "텍스트",
  number: "숫자",
  date: "날짜",
  select: "선택 목록",
};

function splitValues(value: string): string[] {
  return [...new Set(
    value
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean),
  )];
}

function toEditor(definition: ClientStudentCustomFieldDefinition): EditorState {
  return {
    label: definition.label,
    fieldType: definition.fieldType,
    aliases: definition.aliases.join(", "),
    options: definition.options.join(", "),
  };
}

export default function StudentCustomFieldsModal({ open, onClose }: Props) {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editor, setEditor] = useState<EditorState>(EMPTY_EDITOR);

  const definitionsQuery = useQuery({
    queryKey: adminStudentsQueryKeys.customFields,
    queryFn: () => fetchStudentCustomFields(),
    enabled: open,
  });
  const definitions = useMemo(
    () => definitionsQuery.data ?? [],
    [definitionsQuery.data],
  );

  useEffect(() => {
    if (!open) {
      setEditingId(null);
      setEditor(EMPTY_EDITOR);
    }
  }, [open]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const input = {
        label: editor.label.trim(),
        fieldType: editor.fieldType,
        aliases: splitValues(editor.aliases),
        options: editor.fieldType === "select" ? splitValues(editor.options) : [],
      };
      if (editingId === null) {
        return createStudentCustomField({
          ...input,
          position: definitions.length,
          active: true,
        });
      }
      return updateStudentCustomField(editingId, input);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminStudentsQueryKeys.customFields });
      await queryClient.invalidateQueries({ queryKey: adminStudentsQueryKeys.students });
      feedback.success(editingId === null ? "맞춤 컬럼을 추가했습니다." : "맞춤 컬럼을 수정했습니다.");
      setEditingId(null);
      setEditor(EMPTY_EDITOR);
    },
    onError: (error) => {
      feedback.error(getApiErrorMessage(error, "맞춤 컬럼을 저장하지 못했습니다."));
    },
  });

  const activeMutation = useMutation({
    mutationFn: async (definition: ClientStudentCustomFieldDefinition) => {
      if (definition.active) {
        await deactivateStudentCustomField(definition.id);
        return;
      }
      await updateStudentCustomField(definition.id, { active: true });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminStudentsQueryKeys.customFields });
      await queryClient.invalidateQueries({ queryKey: adminStudentsQueryKeys.students });
    },
    onError: (error) => {
      feedback.error(getApiErrorMessage(error, "맞춤 컬럼 상태를 변경하지 못했습니다."));
    },
  });

  const saveDisabled = (
    saveMutation.isPending
    || !editor.label.trim()
    || (editor.fieldType === "select" && splitValues(editor.options).length === 0)
  );

  return (
    <AdminModal open={open} onClose={onClose} type="action" width={MODAL_WIDTH.wide}>
      <ModalHeader
        type="action"
        title="맞춤 컬럼 관리"
        description="학원에서 필요한 학생 정보를 직접 추가합니다. 숨겨도 기존 학생 값과 엑셀 연결은 보존됩니다."
      />
      <ModalBody>
        <div className="modal-scroll-body grid gap-5">
          <div className="modal-form-group">
            <span className="modal-section-label">
              {editingId === null ? "새 컬럼" : "컬럼 수정"}
            </span>
            <div className="modal-form-row modal-form-row--2">
              <input
                className="ds-input"
                value={editor.label}
                onChange={(event) => setEditor((previous) => ({
                  ...previous,
                  label: event.target.value,
                }))}
                placeholder="표시명 (예: MBTI)"
                maxLength={80}
                disabled={saveMutation.isPending}
              />
              <select
                className="ds-select"
                value={editor.fieldType}
                onChange={(event) => setEditor((previous) => ({
                  ...previous,
                  fieldType: event.target.value as StudentCustomFieldType,
                }))}
                disabled={saveMutation.isPending}
              >
                {Object.entries(FIELD_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <input
              className="ds-input"
              value={editor.aliases}
              onChange={(event) => setEditor((previous) => ({
                ...previous,
                aliases: event.target.value,
              }))}
              placeholder="엑셀 별칭, 쉼표로 구분 (선택)"
              disabled={saveMutation.isPending}
            />
            {editor.fieldType === "select" && (
              <textarea
                className="ds-textarea"
                rows={2}
                value={editor.options}
                onChange={(event) => setEditor((previous) => ({
                  ...previous,
                  options: event.target.value,
                }))}
                placeholder="선택지, 쉼표 또는 줄바꿈으로 구분"
                disabled={saveMutation.isPending}
              />
            )}
            <div className="flex justify-end gap-2">
              {editingId !== null && (
                <Button
                  intent="secondary"
                  size="sm"
                  onClick={() => {
                    setEditingId(null);
                    setEditor(EMPTY_EDITOR);
                  }}
                  disabled={saveMutation.isPending}
                >
                  수정 취소
                </Button>
              )}
              <Button
                intent="primary"
                size="sm"
                onClick={() => saveMutation.mutate()}
                disabled={saveDisabled}
              >
                {saveMutation.isPending ? "저장 중…" : editingId === null ? "컬럼 추가" : "수정 저장"}
              </Button>
            </div>
          </div>

          <div className="grid gap-2">
            <span className="modal-section-label">등록된 컬럼 ({definitions.length}/50)</span>
            {definitionsQuery.isLoading ? (
              <EmptyState scope="panel" tone="loading" title="맞춤 컬럼을 불러오는 중…" />
            ) : definitionsQuery.isError ? (
              <EmptyState
                scope="panel"
                tone="error"
                title="맞춤 컬럼을 불러오지 못했습니다"
                actions={(
                  <Button intent="secondary" size="sm" onClick={() => definitionsQuery.refetch()}>
                    다시 시도
                  </Button>
                )}
              />
            ) : definitions.length === 0 ? (
              <EmptyState
                scope="panel"
                tone="empty"
                title="아직 맞춤 컬럼이 없습니다"
                description="위에서 MBTI, 취미, 목표대학처럼 필요한 항목을 추가하세요."
              />
            ) : (
              <div className="grid gap-2">
                {definitions.map((definition) => (
                  <div
                    key={definition.key}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <strong className="truncate text-[14px]">{definition.label}</strong>
                        <span className="text-[12px] text-[var(--color-text-muted)]">
                          {FIELD_TYPE_LABELS[definition.fieldType]}
                        </span>
                        {!definition.active && (
                          <span className="text-[12px] font-semibold text-[var(--color-text-muted)]">숨김</span>
                        )}
                      </div>
                      {definition.aliases.length > 0 && (
                        <div className="truncate text-[12px] text-[var(--color-text-muted)]">
                          엑셀 별칭: {definition.aliases.join(", ")}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        intent="secondary"
                        size="sm"
                        onClick={() => {
                          setEditingId(definition.id);
                          setEditor(toEditor(definition));
                        }}
                        disabled={activeMutation.isPending || saveMutation.isPending}
                      >
                        수정
                      </Button>
                      <Button
                        intent="secondary"
                        size="sm"
                        onClick={() => activeMutation.mutate(definition)}
                        disabled={activeMutation.isPending || saveMutation.isPending}
                      >
                        {definition.active ? "숨기기" : "다시 사용"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </ModalBody>
      <ModalFooter
        right={(
          <Button intent="secondary" onClick={onClose} disabled={saveMutation.isPending}>
            닫기
          </Button>
        )}
      />
    </AdminModal>
  );
}
