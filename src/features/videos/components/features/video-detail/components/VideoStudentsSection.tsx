// PATH: src/features/videos/components/features/video-detail/components/VideoStudentsSection.tsx

import StudentWatchPanel from "./StudentWatchPanel";

interface Props {
  students: any[];
  onOpenPermission: () => void;
}

export default function VideoStudentsSection({
  students,
  onOpenPermission,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="text-xs text-[var(--text-muted)]">
        출결 · 권한 · 진도 요약
      </div>

      <StudentWatchPanel
        students={students}
        selectedEnrollmentId={null}
        onSelectPreviewStudent={() => {}}
        onOpenPermission={onOpenPermission}
      />
    </div>
  );
}
