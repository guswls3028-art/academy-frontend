// PATH: src/features/exams/components/ExamTargetEditModal.tsx

import { useEffect, useState } from "react";
import api from "@/shared/api/axios";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";

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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[520px] rounded bg-surface shadow">
        <div className="border-b px-4 py-3 flex justify-between">
          <div className="text-sm font-semibold">시험 대상 학생</div>
          <button onClick={onClose} className="text-sm text-muted">
            닫기
          </button>
        </div>

        <div className="max-h-[60vh] overflow-auto px-4 py-3">
          {loading ? (
            <div className="text-sm text-muted">불러오는 중...</div>
          ) : (
            <ul className="space-y-1 text-sm">
              {rows.map((r) => (
                <li
                  key={r.enrollment}
                  className="flex justify-between rounded border px-3 py-2"
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

        <div className="border-t px-4 py-2 text-right">
          <button className="btn" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
