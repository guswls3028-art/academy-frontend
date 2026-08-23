// PATH: src/app_admin/domains/videos/components/features/video-detail/components/VideoStudentsSection.tsx

import { FiBarChart2, FiClock } from "react-icons/fi";
import { KPI, Button } from "@/shared/ui/ds";
import {
  VIDEO_COMPLETION_PERCENT,
  isVideoProgressComplete,
  normalizeVideoProgressRatio,
} from "@/shared/api/contracts/videos";
import StudentWatchPanel from "./StudentWatchPanel";
import type { StudentWatchRow } from "./StudentWatchPanel";

interface Props {
  students: StudentWatchRow[];
  onOpenPermission: () => void;
  onOpenAchievement?: () => void;
  onOpenLog?: () => void;
  openingStudentId?: number | null;
  onOpenStudentView: (studentId: number) => void;
}

function percent(v: number) {
  return Number.isFinite(v) ? `${(v * 100).toFixed(1)}%` : "—";
}

export default function VideoStudentsSection({
  students,
  onOpenPermission,
  onOpenAchievement,
  onOpenLog,
  openingStudentId,
  onOpenStudentView,
}: Props) {
  const total = students.length;
  const completed = students.filter((s) => isVideoProgressComplete(s.progress, s.completed)).length;
  const progressSum = students.reduce((a, s) => a + normalizeVideoProgressRatio(s.progress), 0);
  const avgProgress = total > 0 ? progressSum / total : 0;

  return (
    <div className="space-y-5">
      <div className="video-watch-kpis grid grid-cols-3 gap-2 sm:gap-3" aria-label="영상 시청 요약">
        <KPI label="총 학생" value={total > 0 ? `${total}명` : "—"} />
        <KPI label="평균 진도율" value={percent(avgProgress)} />
        <KPI label={`${VIDEO_COMPLETION_PERCENT}% 완료`} value={total > 0 ? `${completed}명` : "—"} />
      </div>

      <StudentWatchPanel
        students={students}
        onOpenPermission={onOpenPermission}
        openingStudentId={openingStudentId}
        onOpenStudentView={onOpenStudentView}
      />

      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-border-divider)] pt-3">
        {typeof onOpenAchievement === "function" && (
          <Button
            type="button"
            intent="ghost"
            size="sm"
            onClick={onOpenAchievement}
            leftIcon={<FiBarChart2 size={14} />}
          >
            학습 성적표
          </Button>
        )}
        {typeof onOpenLog === "function" && (
          <Button
            type="button"
            intent="ghost"
            size="sm"
            onClick={onOpenLog}
            leftIcon={<FiClock size={14} />}
          >
            시청 로그
          </Button>
        )}
      </div>
    </div>
  );
}
