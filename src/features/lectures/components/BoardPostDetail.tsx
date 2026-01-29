// src/features/lectures/components/BoardPostDetail.tsx

import { useQuery } from "@tanstack/react-query";
import { BoardPost, fetchBoardReadStatus } from "../api/board";
import { fetchLectureEnrollments } from "../api/enrollments";

interface Props {
  lectureId: number;
  post: BoardPost;
  onClose: () => void;
}

export default function BoardPostDetail({ lectureId, post, onClose }: Props) {
  const { data: readStatus } = useQuery({
    queryKey: ["board-read-status", post.id],
    queryFn: () => fetchBoardReadStatus(post.id),
  });

  const { data: enrollments } = useQuery({
    queryKey: ["lecture-enrollments", lectureId],
    queryFn: () => fetchLectureEnrollments(lectureId),
  });

  const readMap = new Map<number, string>();
  readStatus?.forEach((r) => {
    readMap.set(r.enrollment, r.checked_at);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="flex w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-lg bg-[var(--bg-surface)] shadow-xl">
        {/* LEFT */}
        <div className="flex-1 overflow-y-auto border-r border-[var(--border-divider)] p-6">
          <div className="mb-4 flex items-start justify-between">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              {post.title}
            </h2>
            <button
              onClick={onClose}
              className="text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            >
              ✕
            </button>
          </div>

          <div className="mb-4 text-xs text-[var(--text-muted)]">
            작성일 {post.created_at.slice(0, 10)}
          </div>

          <div className="whitespace-pre-wrap text-sm text-[var(--text-primary)]">
            {post.content}
          </div>

          {post.attachments?.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-semibold text-[var(--text-secondary)]">
                첨부 파일
              </h3>
              <ul className="space-y-1 text-sm">
                {post.attachments.map((a) => (
                  <li key={a.id}>
                    <a
                      href={a.file}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[var(--color-primary)] hover:underline"
                    >
                      {a.file.split("/").slice(-1)[0]}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* RIGHT */}
        <div className="w-64 overflow-y-auto p-4 text-sm">
          <h3 className="mb-2 font-semibold text-[var(--text-secondary)]">
            확인 현황
          </h3>
          <p className="mb-3 text-xs text-[var(--text-muted)]">
            조회 인원: {readStatus?.length ?? 0}명
          </p>

          <ul className="space-y-1">
            {enrollments?.map((en: any) => {
              const name =
                en.student_name || en.student?.name || "이름 없음";
              const checkedAt = readMap.get(en.id);
              const checked = !!checkedAt;

              return (
                <li
                  key={en.id}
                  className="flex items-center justify-between rounded px-2 py-1 hover:bg-[var(--bg-surface)]"
                >
                  <span className="truncate text-[var(--text-primary)]">
                    {name}
                  </span>
                  <span
                    className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${
                      checked
                        ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                        : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {checked ? checkedAt.slice(5, 16) : "미확인"}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
