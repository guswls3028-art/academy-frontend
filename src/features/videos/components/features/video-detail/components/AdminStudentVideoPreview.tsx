// PATH: src/features/videos/components/features/video-detail/components/AdminStudentVideoPreview.tsx
// 관리자 전용: 학생 앱 플레이어를 "정책 미리보기" 용도로 감싸는 래퍼
// - 특정 학생 선택 없이도 재생 가능
// - audit / progress / heartbeat 저장 ❌
// - 정책(enforcement)만 동일 적용 ✅

import StudentVideoPlayer from "@/student/media/playback/player/StudentVideoPlayer";

interface Props {
  videoId: number;
  enrollmentId?: number | null; // 선택 학생 (옵션)
}

export default function AdminStudentVideoPreview({
  videoId,
  enrollmentId,
}: Props) {
  return (
    <StudentVideoPlayer
      videoId={videoId}
      enrollmentId={enrollmentId ?? -1} // dummy enrollment
      previewMode="admin"
    />
  );
}
