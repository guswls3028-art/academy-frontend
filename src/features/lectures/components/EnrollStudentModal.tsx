// PATH: src/features/lectures/components/EnrollStudentModal.tsx
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { bulkCreateAttendance } from "../api/attendance";
import { fetchStudents as fetchStudentList, type ClientStudent } from "@/features/students/api/students";

import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";
import { Button, EmptyState } from "@/shared/ui/ds";

interface Props {
  sessionId: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type Student = {
  id: number;
  name: string;
  phone?: string | null;
};

export default function EnrollStudentModal({ sessionId, isOpen, onClose, onSuccess }: Props) {
  const qc = useQueryClient();

  const [keyword, setKeyword] = useState("");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  useEffect(() => {
    const t = setTimeout(() => setSearch(keyword.trim()), 300);
    return () => clearTimeout(t);
  }, [keyword]);

  const mutation = useMutation({
    mutationFn: (ids: number[]) => bulkCreateAttendance(sessionId, ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance", sessionId] });
      onSuccess?.();
      onClose();
      setSelectedIds([]);
    },
  });

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!isOpen) return;
      if (e.key === "Escape") onClose();
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        if (selectedIds.length > 0 && !mutation.isPending) {
          mutation.mutate(selectedIds);
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedIds]);

  const { data: students = [], isLoading } = useQuery({
    queryKey: ["enroll-modal-students", search],
    queryFn: async (): Promise<Student[]> => {
      const list: ClientStudent[] = await fetchStudentList(search, {});
      return list.map((s) => ({
        id: s.id,
        name: s.name,
        phone: s.studentPhone,
      }));
    },
    enabled: isOpen,
  });

  const title = useMemo(() => "학생 추가 (세션 기준)", []);

  if (!isOpen) return null;

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <AdminModal open={true} onClose={onClose} type="action" width={720}>
      <ModalHeader
        type="action"
        title={title}
        description="검색 후 체크하여 세션 출결 대상 학생을 추가합니다. (⌘/Ctrl + Enter 추가)"
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
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => toggleSelect(st.id)}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "28px 1fr",
                          gap: 10,
                          padding: "10px 12px",
                          borderTop: "1px solid var(--color-border-divider)",
                          background: checked ? "var(--color-bg-surface-soft)" : "transparent",
                          textAlign: "left",
                          cursor: "pointer",
                        }}
                      >
                        <input type="checkbox" checked={checked} readOnly />
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
                            {st.phone || "-"}
                          </div>
                        </div>
                      </button>
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
