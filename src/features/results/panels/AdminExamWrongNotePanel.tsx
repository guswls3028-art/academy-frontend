import { ApiClient } from "../api/client";
import WrongNotePanel from "../components/WrongNotePanel";

export default function AdminExamWrongNotePanel({
  api,
  enrollmentId,
  examId,
}: {
  api: ApiClient;
  enrollmentId: number;
  examId: number;
}) {
  return (
    <WrongNotePanel
      enrollmentId={enrollmentId}
      examId={examId}
    />
  );
}
