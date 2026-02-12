// PATH: src/features/lectures/components/LectureEnrollStudentModal.tsx
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { bulkCreateEnrollments } from "../api/enrollments";
import { fetchStudents as fetchStudentList, type ClientStudent } from "@/features/students/api/students";

import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";
import { Button, EmptyState } from "@/shared/ui/ds";
import { formatPhone } from "@/shared/utils/formatPhone";

interface Props {
  lectureId: number;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type Student = {
  id: number;
  name: string;
  phone?: string | null;
};

export default function LectureEnrollStudentModal({ lectureId, open, onClose, onSuccess }: Props) {
  const qc = useQueryClient();

  const [keyword, setKeyword] = useState("");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  useEffect(() => {
    const t = setTimeout(() => setSearch(keyword.trim()), 300);
    return () => clearTimeout(t);
  }, [keyword]);

  const mutation = useMutation({
    mutationFn: (ids: number[]) => bulkCreateEnrollments(lectureId, ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lecture-students", lectureId] });
      qc.invalidateQueries({ queryKey: ["lecture-enrollments", lectureId] });
      onSuccess?.();
      onClose();
      setSelectedIds([]);
    },
  });

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "Escape") onClose();
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        if (selectedIds.length > 0 && !mutation.isPending) mutation.mutate(selectedIds);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedIds]);

  const { data: students = [], isLoading } = useQuery({
    queryKey: ["lecture-enroll-modal-students", search],
    queryFn: async (): Promise<Student[]> => {
      const list: ClientStudent[] = await fetchStudentList(search, {});
      return list.map((s) => ({
        id: s.id,
        name: s.name,
        phone: s.studentPhone,
      }));
    },
    enabled: open,
  });

  if (!open) return null;

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <AdminModal open onClose={onClose} type="action" width={720}>
      <ModalHeader
        type="action"
        title="수강생 등록"
        description="검색 후 체크하여 강의 수강생을 추가합니다. (⌘/Ctrl + Enter 추가)"
      />

      <ModalBody>
        <div style={{ display: "grid", gap: 12 }}>
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="학생 이름 검색"
            className="ds-input"
            autoFocus
          />

          <div
            style={{
              borderRadius: 14,
              border: "1px solid var(--color-border-divider)",
              background: "var(--color-bg-surface)",
              overflow: "hidden",
            }}
          >
            <div style={{ maxHeight: 320, overflow: "auto" }}>
              {isLoading ? (
                <EmptyState mode="embedded" scope="panel" tone="loading" title="불러오는 중…" />
              ) : students.length === 0 ? (
                <EmptyState
                  mode="embedded"
                  scope="panel"
                  title="학생이 없습니다."
                  description="검색어를 변경해 보세요."
                />
              ) : (
                <div style={{ display: "grid" }}>
                  {students.map((st) => {
                    const checked = selectedIds.includes(st.id);
                    return (
                      <Button
                        key={st.id}
                        type="button"
                        intent="ghost"
                        size="md"
                        onClick={() => toggleSelect(st.id)}
                        className="!block !w-full !grid !grid-cols-[28px_1fr] !gap-2.5 !py-2.5 !px-3 !text-left !justify-start border-t border-[var(--color-border-divider)]"
                        style={{
                          background: checked ? "var(--color-bg-surface-soft)" : "transparent",
                        }}
                      >
                        <input type="checkbox" checked={checked} readOnly className="mt-0.5" />
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 900,
                              color: "var(--color-text-primary)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {st.name}
                          </div>
                          <div style={{ fontSize: 11, fontWeight: 850, color: "var(--color-text-muted)" }}>
                            {formatPhone(st.phone)}
                          </div>
                        </div>
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div style={{ fontSize: 11, fontWeight: 850, color: "var(--color-text-muted)" }}>
            선택: {selectedIds.length}명
          </div>
        </div>
      </ModalBody>

      <ModalFooter
        left={
          <span style={{ fontSize: 12, fontWeight: 850, color: "var(--color-text-muted)" }}>
            ESC 로 닫기 · ⌘/Ctrl + Enter 추가
          </span>
        }
        right={
          <>
            <Button intent="secondary" onClick={onClose}>
              취소
            </Button>
            <Button
              intent="primary"
              onClick={() => mutation.mutate(selectedIds)}
              disabled={mutation.isPending || selectedIds.length === 0}
            >
              {mutation.isPending ? "추가 중…" : "추가"}
            </Button>
          </>
        }
      />
    </AdminModal>
  );
}
