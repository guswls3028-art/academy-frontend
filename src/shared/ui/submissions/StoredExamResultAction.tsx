import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { scoresQueryKeys } from "@/shared/api/queryKeys/scores";
import { fetchStoredExamResult } from "@/shared/api/contracts/storedExamResult";
import { Button } from "@/shared/ui/ds";
import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";

type ResultRow = {
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
      {row.target_id > 0 && row.enrollment_id != null && row.enrollment_id > 0 && (
        <>
          <Button size="sm" onClick={() => setOpen(true)}>저장된 성적 보기</Button>
          {open && <StoredExamResultDialog examId={row.target_id} enrollmentId={row.enrollment_id}
            title={row.target_title} student={row.student_name} onClose={() => setOpen(false)} />}
        </>
      )}
    </div>
  );
}

function StoredExamResultDialog({ examId, enrollmentId, title, student, onClose }: {
  examId: number; enrollmentId: number; title: string; student: string; onClose: () => void;
}) {
  const query = useQuery({
    queryKey: scoresQueryKeys.storedExamResult(examId, enrollmentId),
    queryFn: async () => {
      const data = await fetchStoredExamResult(examId, enrollmentId);
      if (data.target_id !== examId || data.enrollment_id !== enrollmentId) throw new Error("성적 식별자가 일치하지 않습니다.");
      return data;
    },
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
          <p>{query.data.total_score == null ? "저장된 점수가 없습니다." :
            `점수 ${query.data.total_score}점${query.data.max_score == null ? "" : ` / ${query.data.max_score}점`}`}</p>
        )}
      </ModalBody>
      <ModalFooter right={<Button size="sm" onClick={onClose}>닫기</Button>} />
    </AdminModal>
  );
}
