import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, EmptyState } from "@/shared/ui/ds";
import { assessmentQueryKeys } from "@/shared/api/queryKeys/assessments";
import { fetchStudentHomeworkFiles, type HomeworkSubmissionMediaFile } from "@/shared/api/contracts/staffHomeworkFiles";
import HomeworkFileGallery from "@/shared/ui/submissions/HomeworkFileGallery";
import HomeworkAcceptanceButton from "@/shared/ui/submissions/HomeworkAcceptanceButton";
import HomeworkMediaPreviewModal from "@/shared/ui/media/HomeworkMediaPreviewModal";

export default function StudentHomeworkFiles({ studentId }: { studentId: number }) {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<{ homeworkId: number; file: HomeworkSubmissionMediaFile; fingerprint: string | null } | null>(null);
  const list = useQuery({
    queryKey: assessmentQueryKeys.studentHomeworkFilesPage(studentId, page),
    queryFn: ({ signal }) => fetchStudentHomeworkFiles(studentId, page, signal),
  });
  if (list.isPending) return <EmptyState scope="panel" tone="loading" title="제출물을 불러오는 중…" />;
  if (list.isError) return <EmptyState scope="panel" tone="error" title="제출물을 불러오지 못했습니다"
    actions={<><Button onClick={() => void list.refetch()}>다시 시도</Button>
      {page > 1 && <Button onClick={() => setPage(1)}>첫 페이지</Button>}</>} />;
  const data = list.data;
  return (
    <section aria-label="온라인 과제 제출물" className="grid min-w-0 gap-3">
      <h3 className="text-base font-semibold">온라인 과제 제출물</h3>
      {data.results.length === 0 && <EmptyState scope="panel" tone="empty" title="제출한 과제 파일이 없습니다" />}
      {data.results.map(row => (
        <article key={row.id} className="min-w-0 rounded-xl border border-[var(--color-border-divider)] p-3">
          <header className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h4 className="break-words text-sm font-bold">{row.homework_title}</h4>
              <p className="break-words text-xs">{[row.lecture_title, row.session_title, row.submitted_at && new Date(row.submitted_at).toLocaleDateString("ko-KR")].filter(Boolean).join(" · ")}</p>
            </div>
            <HomeworkAcceptanceButton homeworkId={row.homework_id} sessionId={row.session_id} studentId={studentId}
              enrollmentId={row.enrollment_id} accepted={row.teacher_accepted} updatedAt={row.teacher_accepted_updated_at}
              fingerprint={row.media_set_fingerprint} />
          </header>
          <HomeworkFileGallery homeworkId={row.homework_id} files={row.files} fingerprint={row.media_set_fingerprint}
            onOpen={file => setSelected({ homeworkId: row.homework_id, file, fingerprint: row.media_set_fingerprint })} />
        </article>
      ))}
      {(page > 1 || data.next) && <nav aria-label="제출물 페이지" className="flex items-center justify-center gap-3">
        <Button type="button" disabled={page === 1} onClick={() => setPage(page - 1)}>이전</Button>
        <span>{page}페이지</span>
        <Button type="button" disabled={!data.next} onClick={() => setPage(page + 1)}>다음</Button>
      </nav>}
      {selected && <HomeworkMediaPreviewModal open aboveStudentDetail homeworkId={selected.homeworkId} file={selected.file}
        mediaSetFingerprint={selected.fingerprint} onClose={() => setSelected(null)} />}
    </section>
  );
}
