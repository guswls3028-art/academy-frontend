// PATH: src/app_admin/domains/lectures/components/EnrollStudentModal.tsx
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { bulkCreateAttendance } from "../api/attendance";
import { fetchStudents } from "@admin/domains/students/api/students.api";

import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";
import { feedback } from "@/shared/ui/feedback/feedback";
import { extractApiError } from "@/shared/utils/extractApiError";
import { Button, EmptyState } from "@/shared/ui/ds";
import { formatPhone } from "@/shared/utils/formatPhone";
import styles from "./EnrollStudentModal.module.css";

interface Props {
  sessionId: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type Student = {
  id: number;
  name: string;
  displayName: string;
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
    mutationFn: (studentIds: number[]) => bulkCreateAttendance(sessionId, studentIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance", sessionId] });
      feedback.success("수강생이 추가되었습니다.");
      onSuccess?.();
      onClose();
      setSelectedIds([]);
    },
    onError: (e: unknown) => {
      feedback.error(extractApiError(e, "수강생 추가에 실패했습니다."));
    },
  });

  const { data: students = [], isLoading } = useQuery({
    queryKey: ["enroll-modal-students", search],
    queryFn: async (): Promise<Student[]> => {
      const { data } = await fetchStudents(search, { page_size: 100 }, "", 1);
      return data.map((s) => ({
        id: s.id,
        name: s.name,
        displayName: s.displayName,
        phone: s.studentPhone,
      }));
    },
    enabled: isOpen,
  });

  const title = useMemo(() => "학생 추가 (세션 기준)", []);

  if (!isOpen) return null;

  const toggleSelect = (studentId: number) => {
    setSelectedIds((prev) => (prev.includes(studentId) ? prev.filter((x) => x !== studentId) : [...prev, studentId]));
  };

  return (
    <AdminModal open={true} onClose={onClose} type="action" width={720} onEnterConfirm={selectedIds.length > 0 && !mutation.isPending ? () => mutation.mutate(selectedIds) : undefined}>
      <ModalHeader
        type="action"
        title={title}
        description="검색 후 체크하여 세션 출결 대상 학생을 추가합니다."
      />

      <ModalBody>
        <div className={styles.body}>
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="학생 이름 검색"
            className="ds-input"
            autoFocus
          />

          <div className={styles.studentPanel}>
            <div className={styles.studentScroller}>
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
                <div className={styles.studentList}>
                  {students.map((st) => {
                    const checked = selectedIds.includes(st.id);
                    return (
                      <label
                        key={st.id}
                        className={`${styles.studentRow} ${checked ? styles.studentRowSelected : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelect(st.id)}
                          className={styles.studentCheckbox}
                        />
                        <div className={styles.studentMeta}>
                          <div className={styles.studentName}>
                            {st.displayName}
                          </div>
                          <div className={styles.studentPhone}>
                            {formatPhone(st.phone)}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className={styles.selectionSummary}>
            선택: {selectedIds.length}명
          </div>
        </div>
      </ModalBody>

      <ModalFooter
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
