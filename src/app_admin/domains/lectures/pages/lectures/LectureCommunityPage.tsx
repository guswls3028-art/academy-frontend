import { useParams } from "react-router";
import { EmptyState } from "@/shared/ui/ds";
import LectureCommunityBoard from "@admin/domains/community/public/LectureCommunityBoard";

export default function LectureCommunityPage() {
  const { lectureId: value } = useParams<{ lectureId: string }>();
  const lectureId = Number(value);
  if (!value || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(lectureId)) {
    return <EmptyState mode="embedded" scope="panel" title="강의를 찾을 수 없습니다." />;
  }
  return <LectureCommunityBoard key={lectureId} lectureId={lectureId} />;
}
