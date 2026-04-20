/**
 * 공지 상세 페이지
 */
import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import DOMPurify from "dompurify";
import StudentPageShell from "@student/shared/ui/pages/StudentPageShell";
import { fetchNoticeDetail } from "../api/notices.api";
import EmptyState from "@student/layout/EmptyState";
import { formatYmd } from "@student/shared/utils/date";
import { getAttachmentDownloadUrl, type PostAttachment } from "@admin/domains/community/api/community.api";

export default function NoticeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const noticeId = id ? Number(id) : null;

  const { data: notice, isLoading, isError, refetch } = useQuery({
    queryKey: ["student-notice", noticeId],
    queryFn: () => (noticeId != null ? fetchNoticeDetail(noticeId) : Promise.resolve(null)),
    enabled: noticeId != null,
  });

  if (isLoading) {
    return (
      <StudentPageShell title="공지사항">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-4)" }}>
          <div className="stu-skel" style={{ height: 28, width: "70%", borderRadius: "var(--stu-radius)" }} />
          <div className="stu-skel" style={{ height: 16, width: "40%", borderRadius: "var(--stu-radius-sm)" }} />
          <div className="stu-skel" style={{ height: 120, borderRadius: "var(--stu-radius)" }} />
          <div className="stu-skel" style={{ height: 60, borderRadius: "var(--stu-radius)" }} />
        </div>
      </StudentPageShell>
    );
  }

  if (isError || !notice || noticeId == null) {
    return (
      <StudentPageShell title="공지사항">
        <EmptyState
          title="공지를 불러오지 못했습니다."
          description="잠시 후 다시 시도해주세요."
          onRetry={() => refetch()}
        />
      </StudentPageShell>
    );
  }

  const firstNode = notice.mappings?.[0]?.node_detail;
  const lectureTitle = firstNode?.lecture_title;

  return (
    <StudentPageShell title="공지사항" onBack={() => navigate("/student/notices")}>
      <div>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-4)" }}>
          {/* 제목 */}
          <div>
            <h1 style={{ fontWeight: 700, fontSize: 20, marginBottom: "var(--stu-space-3)" }}>
              {notice.title}
            </h1>
            <div style={{ display: "flex", gap: "var(--stu-space-2)", alignItems: "center", flexWrap: "wrap" }}>
              {lectureTitle && (
                <span
                  className="stu-muted"
                  style={{
                    fontSize: 12,
                    padding: "4px 10px",
                    borderRadius: 6,
                    background: "var(--stu-surface-soft)",
                  }}
                >
                  {lectureTitle}
                </span>
              )}
              <span className="stu-muted" style={{ fontSize: 13 }}>
                {formatYmd(notice.created_at)}
              </span>
            </div>
          </div>

          {/* 내용 */}
          {notice.content ? (
            <div
              className="stu-html-content"
              style={{ fontSize: 15, lineHeight: 1.7, wordBreak: "break-word" }}
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(notice.content) }}
            />
          ) : (
            <p style={{ color: "var(--stu-text-muted)", fontSize: 15 }}>내용이 없습니다.</p>
          )}

          {/* 첨부파일 */}
          {notice.attachments && notice.attachments.length > 0 && (
            <NoticeAttachments postId={notice.id} attachments={notice.attachments} />
          )}

          {/* 목록으로 돌아가기 */}
          <div style={{ marginTop: "var(--stu-space-4)", paddingTop: "var(--stu-space-4)", borderTop: "1px solid var(--stu-border)" }}>
            <Link
              to="/student/notices"
              className="stu-btn stu-btn--secondary stu-btn--sm"
              style={{ display: "inline-block" }}
            >
              목록으로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    </StudentPageShell>
  );
}

function NoticeAttachments({ postId, attachments }: { postId: number; attachments: PostAttachment[] }) {
  const [imgUrls, setImgUrls] = useState<Record<number, string>>({});
  const isImage = (ct: string) => ct.startsWith("image/");

  useEffect(() => {
    const images = attachments.filter((a) => isImage(a.content_type));
    if (images.length === 0) return;
    let cancelled = false;
    (async () => {
      const urls: Record<number, string> = {};
      for (const img of images) {
        try {
          const { url } = await getAttachmentDownloadUrl(postId, img.id);
          if (!cancelled) urls[img.id] = url;
        } catch { /* skip */ }
      }
      if (!cancelled) setImgUrls(urls);
    })();
    return () => { cancelled = true; };
  }, [attachments, postId]);

  const handleDownload = async (att: PostAttachment) => {
    try {
      const { url } = await getAttachmentDownloadUrl(postId, att.id);
      const { downloadPresignedUrl } = await import("@/shared/utils/safeDownload");
      downloadPresignedUrl(url, att.original_name);
    } catch {
      const { studentToast } = await import("@student/shared/ui/feedback/studentToast");
      studentToast.error("파일을 다운로드하지 못했습니다.");
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-3)" }}>
      {attachments.filter((a) => isImage(a.content_type)).map((att) => (
        <div key={`img-${att.id}`} style={{ borderRadius: "var(--stu-radius)", overflow: "hidden", border: "1px solid var(--stu-border-subtle)" }}>
          {imgUrls[att.id] ? (
            <img src={imgUrls[att.id]} alt={att.original_name} style={{ width: "100%", maxHeight: 400, objectFit: "contain", display: "block", background: "var(--stu-surface-soft)" }} />
          ) : (
            <div style={{ height: 100, display: "grid", placeItems: "center", background: "var(--stu-surface-soft)", fontSize: 13, color: "var(--stu-text-muted)" }}>이미지 로딩 중…</div>
          )}
        </div>
      ))}
      {attachments.filter((a) => !isImage(a.content_type)).length > 0 && (
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--stu-text-muted)" }}>
          첨부파일 ({attachments.filter((a) => !isImage(a.content_type)).length})
        </div>
      )}
      {attachments.filter((a) => !isImage(a.content_type)).map((att) => (
        <button
          key={att.id}
          type="button"
          onClick={() => handleDownload(att)}
          className="stu-panel stu-panel--pressable"
          style={{ display: "flex", alignItems: "center", gap: "var(--stu-space-3)", padding: "10px var(--stu-space-4)", textAlign: "left", cursor: "pointer" }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0, color: "var(--stu-primary)" }}>
            <path d="M10 1H4.5A1.5 1.5 0 003 2.5v13A1.5 1.5 0 004.5 17h9a1.5 1.5 0 001.5-1.5V6L10 1z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M10 1v5h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{att.original_name}</div>
            <div className="stu-muted" style={{ fontSize: 12 }}>{formatSize(att.size_bytes)}</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, color: "var(--stu-text-muted)" }}>
            <path d="M8 2v9M4 7l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2 12v2h12v-2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ))}
    </div>
  );
}
