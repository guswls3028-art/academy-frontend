// PATH: src/features/lectures/components/BoardPostDetail.tsx
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { BoardPost, fetchBoardReadStatus } from "../api/board";
import { fetchLectureEnrollments } from "../api/enrollments";

import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";
import { Button, EmptyState } from "@/shared/ui/ds";

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

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const readMap = useMemo(() => {
    const m = new Map<number, string>();
    readStatus?.forEach((r) => m.set(r.enrollment, r.checked_at));
    return m;
  }, [readStatus]);

  const headerDesc = `작성일 ${post.created_at?.slice(0, 10) ?? "-"}`;

  return (
    <AdminModal open={true} onClose={onClose} type="inspect" width={1180}>
      <ModalHeader type="inspect" title={post.title} description={headerDesc} />

      <ModalBody>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 16 }}>
          {/* LEFT */}
          <div
            style={{
              borderRadius: "var(--radius-xl)",
              border: "1px solid var(--color-border-divider)",
              background: "var(--color-bg-surface)",
              padding: 16,
              minHeight: 360,
            }}
          >
            <div
              style={{
                whiteSpace: "pre-wrap",
                fontSize: 13,
                fontWeight: 850,
                color: "var(--color-text-primary)",
                lineHeight: 1.65,
              }}
            >
              {post.content}
            </div>

            {post.attachments?.length > 0 && (
              <div style={{ marginTop: 18 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 900,
                    color: "var(--color-text-secondary)",
                    marginBottom: 8,
                  }}
                >
                  첨부 파일
                </div>

                <div
                  style={{
                    borderRadius: 14,
                    border: "1px solid var(--color-border-divider)",
                    background: "var(--color-bg-surface-soft)",
                    padding: 12,
                    display: "grid",
                    gap: 6,
                  }}
                >
                  {post.attachments.map((a) => {
                    const name = a.file?.split("/").slice(-1)[0] ?? "파일";
                    return (
                      <a
                        key={a.id}
                        href={a.file}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          color: "var(--color-primary)",
                          fontWeight: 900,
                          fontSize: 12,
                        }}
                      >
                        {name}
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT */}
          <div
            style={{
              borderRadius: "var(--radius-xl)",
              border: "1px solid var(--color-border-divider)",
              background: "var(--color-bg-surface)",
              padding: 14,
              overflow: "hidden",
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: "var(--color-text-secondary)" }}>
                확인 현황
              </div>
              <div style={{ fontSize: 11, fontWeight: 850, color: "var(--color-text-muted)" }}>
                {readStatus?.length ?? 0}명 확인
              </div>
            </div>

            <div style={{ marginTop: 10, maxHeight: 420, overflow: "auto" }}>
              {!enrollments?.length ? (
                <EmptyState mode="embedded" scope="panel" title="수강생이 없습니다." />
              ) : (
                <div style={{ display: "grid", gap: 6 }}>
                  {enrollments.map((en: any) => {
                    const name = en.student_name || en.student?.name || "이름 없음";
                    const checkedAt = readMap.get(en.id);
                    const checked = !!checkedAt;

                    return (
                      <div
                        key={en.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 10,
                          padding: "8px 10px",
                          borderRadius: 12,
                          border: "1px solid var(--color-border-divider)",
                          background: "var(--color-bg-surface-soft)",
                        }}
                      >
                        <div
                          style={{
                            minWidth: 0,
                            fontSize: 12,
                            fontWeight: 900,
                            color: "var(--color-text-primary)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {name}
                        </div>

                        <div
                          style={{
                            flex: "0 0 auto",
                            padding: "4px 8px",
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 900,
                            border: "1px solid var(--color-border-divider)",
                            background: checked
                              ? "color-mix(in srgb, var(--color-primary) 10%, var(--color-bg-surface))"
                              : "var(--color-bg-surface)",
                            color: checked ? "var(--color-primary)" : "var(--color-text-muted)",
                          }}
                        >
                          {checked ? checkedAt!.slice(5, 16) : "미확인"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </ModalBody>

      <ModalFooter
        left={
          <span style={{ fontSize: 12, fontWeight: 850, color: "var(--color-text-muted)" }}>
            ESC 로 닫기
          </span>
        }
        right={
          <Button intent="secondary" onClick={onClose}>
            닫기
          </Button>
        }
      />
    </AdminModal>
  );
}
