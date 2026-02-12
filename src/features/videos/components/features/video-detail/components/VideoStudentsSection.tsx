// PATH: src/features/videos/components/features/video-detail/components/VideoStudentsSection.tsx

import { FiSettings, FiBarChart2, FiClock } from "react-icons/fi";
import { KPI, Button } from "@/shared/ui/ds";
import StudentWatchPanel from "./StudentWatchPanel";

interface Props {
  students: any[];
  onOpenPermission: () => void;
  onOpenAchievement?: () => void;
  onOpenLog?: () => void;
}

function percent(v: number) {
  return Number.isFinite(v) ? `${(v * 100).toFixed(1)}%` : "—";
}

export default function VideoStudentsSection({
  students,
  onOpenPermission,
  onOpenAchievement,
  onOpenLog,
}: Props) {
  const total = students.length;
  const completed100 = students.filter((s) => (Number(s.progress ?? 0) || 0) >= 1).length;
  const progressSum = students.reduce((a, s) => a + (Number(s.progress ?? 0) || 0), 0);
  const avgProgress = total > 0 ? progressSum / total : 0;

  return (
    <div className="space-y-5">
      {/* 상단 KPI 3개 */}
      <div className="grid grid-cols-3 gap-3">
        <KPI label="총 학생" value={total > 0 ? `${total}명` : "—"} />
        <KPI label="평균 만족도" value={percent(avgProgress)} />
        <KPI label="100% 완료" value={total > 0 ? `${completed100}명` : "—"} />
      </div>

      <StudentWatchPanel
        students={students}
        selectedEnrollmentId={null}
        onSelectPreviewStudent={() => {}}
        onOpenPermission={onOpenPermission}
      />

      {/* 하단 3버튼: 권한 설정 / 학습 성적표 / 시청 로그 */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--color-border-divider)]">
        <Button
          type="button"
          intent="secondary"
          size="sm"
          onClick={onOpenPermission}
          className="inline-flex items-center gap-1.5"
        >
          <FiSettings size={14} />
          권한 설정
        </Button>
        {typeof onOpenAchievement === "function" && (
          <Button
            type="button"
            intent="ghost"
            size="sm"
            onClick={onOpenAchievement}
            className="inline-flex items-center gap-1.5"
          >
            <FiBarChart2 size={14} />
            학습 성적표
          </Button>
        )}
        {typeof onOpenLog === "function" && (
          <Button
            type="button"
            intent="ghost"
            size="sm"
            onClick={onOpenLog}
            className="inline-flex items-center gap-1.5"
          >
            <FiClock size={14} />
            시청 로그
          </Button>
        )}
      </div>
    </div>
  );
}
