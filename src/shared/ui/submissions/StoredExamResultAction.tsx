import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { scoresQueryKeys } from "@/shared/api/queryKeys/scores";
import { fetchStoredSubmissionScore } from "@/shared/api/contracts/submissions";
import { Button } from "@/shared/ui/ds";
import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";

type ResultRow = {
  id: number;
  target_id: number;
  target_title: string;
  enrollment_id: number | null;
  student_name: string;
};

export default function StoredExamResultAction({ row }: { row: ResultRow }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-w-0 flex-col items-end gap-1">
      <span className="text-xs">현재 조회 가능한 차시 없음</span>
      {row.id > 0 && row.target_id > 0 && row.enrollment_id != null && row.enrollment_id > 0 && (
        <>
          <Button size="sm" onClick={() => setOpen(true)}>저장된 성적 보기</Button>
          {open && <StoredExamResultDialog submissionId={row.id} examId={row.target_id} enrollmentId={row.enrollment_id}
            title={row.target_title} student={row.student_name} onClose={() => setOpen(false)} />}
        </>
      )}
    </div>
  );
}

function StoredExamResultDialog({ examId, submissionId, enrollmentId, title, student, onClose }: {
  examId: number; submissionId: number; enrollmentId: number; title: string; student: string; onClose: () => void;
}) {
  const query = useQuery({
    queryKey: scoresQueryKeys.storedSubmissionScore(examId, submissionId, enrollmentId),
    queryFn: () => fetchStoredSubmissionScore(examId, submissionId, enrollmentId),
    retry: false,
    gcTime: 0,
  });
  return (
    <AdminModal open onClose={onClose} size="sm" type="action">
      <ModalHeader title="저장된 성적" description={[title, student].filter(Boolean).join(" · ")} />
      <ModalBody>
        {query.isError ? (
          <div role="alert">
            <p>저장된 성적을 불러오지 못했습니다.</p>
            <Button size="sm" onClick={() => void query.refetch()}>다시 시도</Button>
          </div>
        ) : query.isPending ? <p role="status">성적을 불러오는 중…</p> : (
          <p>{query.data === null ? "이 제출에 저장된 점수가 없습니다." : `이 제출의 저장 점수: ${query.data}점`}</p>
        )}
      </ModalBody>
      <ModalFooter right={<Button size="sm" onClick={onClose}>닫기</Button>} />
    </AdminModal>
  );
}
