// PATH: src/features/exams/components/ExamTargetEditModal.tsx

import { useEffect, useState } from "react";
import api from "@/shared/api/axios";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import { AdminModal, ModalHeader, ModalBody, ModalFooter } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";

type SessionEnrollment = {
  enrollment: number;
  student_name: string;
  profile_photo_url?: string | null;
  lecture_title?: string | null;
  lecture_color?: string | null;
  lecture_chip_label?: string | null;
  name_highlight_clinic_target?: boolean;
};

export default function ExamTargetEditModal({
  sessionId,
  open,
  onClose,
}: {
  sessionId: number;
  open: boolean;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<SessionEnrollment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;

    setLoading(true);
    api
      .get("/enrollments/session-enrollments/", {
        params: { session: sessionId },
      })
      .then((res) => {
        setRows(res.data?.results ?? res.data ?? []);
      })
      .finally(() => setLoading(false));
  }, [open, sessionId]);

  return (
    <AdminModal open={open} onClose={onClose} type="inspect" width={520}>
      <ModalHeader type="inspect" title="시험 대상 학생" />
      <ModalBody>
        <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
          {loading ? (
            <div className="text-sm text-[var(--color-text-muted)] py-4 text-center">불러오는 중...</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-[var(--color-text-muted)] py-4 text-center">등록된 대상 학생이 없습니다.</div>
          ) : (
            <ul className="space-y-1 text-sm">
              {rows.map((r) => (
                <li
                  key={r.enrollment}
                  className="flex justify-between rounded border border-[var(--color-border-divider)] px-3 py-2"
                >
                  <StudentNameWithLectureChip
                    name={r.student_name}
                    profilePhotoUrl={r.profile_photo_url}
                    avatarSize={20}
                    lectures={r.lecture_title ? [{ lectureName: r.lecture_title, color: r.lecture_color, chipLabel: r.lecture_chip_label }] : undefined}
                    clinicHighlight={r.name_highlight_clinic_target === true}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </ModalBody>
      <ModalFooter right={<Button intent="secondary" onClick={onClose}>닫기</Button>} />
    </AdminModal>
  );
}
