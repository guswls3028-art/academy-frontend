// src/features/videos/pages/sections/VideoStudentsSection.tsx

import StudentWatchPanel from "@/features/videos/components/StudentWatchPanel";

interface Props {
  students: any[];
  onOpenPermission: () => void;
}

export default function VideoStudentsSection({
  students,
  onOpenPermission,
}: Props) {
  return (
    <StudentWatchPanel
      students={students}
      selectedEnrollmentId={null}
      onSelectPreviewStudent={() => {}}
      onOpenPermission={onOpenPermission}
    />
  );
}
