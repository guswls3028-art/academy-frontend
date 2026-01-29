// src/features/videos/components/StudentWatchPanel.tsx

import { useMemo } from "react";

interface Props {
  students: any[];
  onOpenPermission: () => void;

  /**
   * 선택된 학생 (관리자 미리보기용)
   */
  selectedEnrollmentId?: number | null;

  /**
   * 선택 기능은 옵션
   * - 없으면: 표시 전용
   * - 있으면: 관리자 미리보기 / drill-down
   */
  onSelectPreviewStudent?: (enrollmentId: number) => void;
}

export default function StudentWatchPanel({
  students,
  onOpenPermission,
  selectedEnrollmentId,
  onSelectPreviewStudent,
}: Props) {
  const selectable = typeof onSelectPreviewStudent === "function";

  // 이름 정렬
  const sorted = useMemo(() => {
    return [...students].sort((a, b) =>
      a.student_name.localeCompare(b.student_name)
    );
  }, [students]);

  // 공통 뱃지
  const badge = (text: string, color: string) => (
    <span
      className={`w-5 h-5 rounded text-white text-[11px] flex items-center justify-center ${color}`}
    >
      {text}
    </span>
  );

  // 출석 뱃지
  const attendanceBadge = (status: string | null) => {
    switch (status) {
      case "PRESENT":
        return badge("출", "bg-green-600");
      case "LATE":
        return badge("지", "bg-yellow-500");
      case "ONLINE":
        return badge("영", "bg-blue-600");
      case "SUPPLEMENT":
        return badge("보", "bg-teal-600");
      case "EARLY_LEAVE":
        return badge("퇴", "bg-orange-500");
      case "ABSENT":
        return badge("결", "bg-red-600");
      case "RUNAWAY":
        return badge("튀", "bg-red-800");
      case "MATERIAL":
        return badge("자", "bg-purple-600");
      case "INACTIVE":
        return badge("부", "bg-yellow-500");
      case "SECESSION":
        return badge("탈", "bg-gray-500");
      default:
        return badge("-", "bg-gray-400");
    }
  };

  // 권한 뱃지
  const ruleBadge = (rule: string | null) => {
    switch (rule) {
      case "free":
        return badge("자", "bg-green-600");
      case "once":
        return badge("1", "bg-yellow-500");
      case "blocked":
        return badge("X", "bg-red-600");
      default:
        return badge("-", "bg-gray-400");
    }
  };

  return (
    <div className="w-[520px] flex flex-col gap-3">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">학생 시청 현황</div>

        <button
          onClick={onOpenPermission}
          className="text-xs rounded bg-blue-600 text-white px-3 py-1.5"
        >
          권한 관리
        </button>
      </div>

      {/* LIST */}
      <div className="flex flex-col gap-2">
        {sorted.map((s: any) => {
          const progress = Math.round((s.progress ?? 0) * 100);
          const clickable = selectable && s.enrollment;
          const selected = selectedEnrollmentId === s.enrollment;

          return (
            <div
              key={`student-${s.enrollment}`}
              role={clickable ? "button" : undefined}
              tabIndex={clickable ? 0 : -1}
              onClick={() => {
                if (clickable) {
                  onSelectPreviewStudent!(s.enrollment);
                }
              }}
              className={`rounded border px-3 py-2 flex items-center gap-2 text-sm
                ${clickable ? "cursor-pointer hover:bg-gray-50" : ""}
                ${selected ? "border-blue-500 bg-blue-50" : "bg-white"}
              `}
            >
              {/* NAME */}
              <div className="w-[60px] truncate font-medium">
                {s.student_name}
              </div>

              {/* BADGES */}
              <div className="flex items-center gap-1 w-[52px]">
                {attendanceBadge(s.attendance_status)}
                {ruleBadge(s.effective_rule)}
              </div>

              {/* PROGRESS */}
              <div className="flex-1 flex items-center gap-2">
                <div className="flex-1 h-[8px] rounded bg-gray-200 overflow-hidden">
                  <div
                    className={`h-full ${
                      progress >= 95
                        ? "bg-green-500"
                        : progress >= 50
                        ? "bg-yellow-500"
                        : "bg-red-500"
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="w-[40px] text-right text-xs text-gray-600">
                  {progress}%
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
