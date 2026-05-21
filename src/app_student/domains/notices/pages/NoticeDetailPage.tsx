/**
 * 공지 상세 페이지
 */
import { useState, useEffect, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import DOMPurify from "dompurify";
import StudentPageShell from "@student/shared/ui/pages/StudentPageShell";
import { fetchNoticeDetail } from "../api/notices.api";
import EmptyState from "@student/layout/EmptyState";
import { formatYmd } from "@student/shared/utils/date";
import { getAttachmentDownloadUrl, type PostAttachment } from "@admin/domains/community/api/community.api";
import styles from "./NoticeDetailPage.module.css";

function isImageAttachment(att: PostAttachment): boolean {
  return att.content_type.startsWith("image/");
}

function formatAttachmentSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

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
        <div className={styles.loadingStack}>
          <div className={`stu-skel ${styles.skelTitle}`} />
          <div className={`stu-skel ${styles.skelMeta}`} />
          <div className={`stu-skel ${styles.skelContent}`} />
          <div className={`stu-skel ${styles.skelAttachment}`} />
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
        <div className={styles.stack}>
          {/* 제목 */}
          <div>
            <h1 className={styles.title}>
              {notice.title}
            </h1>
            <div className={styles.metaRow}>
              {lectureTitle && (
                <span className={`stu-muted ${styles.lectureBadge}`}>
                  {lectureTitle}
                </span>
              )}
              <span className={`stu-muted ${styles.dateText}`}>
                {formatYmd(notice.created_at)}
              </span>
            </div>
          </div>

          {/* 내용 */}
          {notice.content ? (
            <div
              className={`stu-html-content ${styles.content}`}
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(notice.content) }}
            />
          ) : (
            <p className={styles.emptyContent}>내용이 없습니다.</p>
          )}

          {/* 첨부파일 */}
          {notice.attachments && notice.attachments.length > 0 && (
            <NoticeAttachments postId={notice.id} attachments={notice.attachments} />
          )}

          {/* 목록으로 돌아가기 */}
          <div className={styles.footer}>
            <Link
              to="/student/notices"
              className={`stu-btn stu-btn--secondary stu-btn--sm ${styles.backLink}`}
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
  const imageAttachments = useMemo(() => attachments.filter(isImageAttachment), [attachments]);
  const fileAttachments = useMemo(() => attachments.filter((att) => !isImageAttachment(att)), [attachments]);

  useEffect(() => {
    if (imageAttachments.length === 0) return;
    let cancelled = false;
    (async () => {
      const urls: Record<number, string> = {};
      for (const img of imageAttachments) {
        try {
          const { url } = await getAttachmentDownloadUrl(postId, img.id);
          if (!cancelled) urls[img.id] = url;
        } catch { /* skip */ }
      }
      if (!cancelled) setImgUrls(urls);
    })();
    return () => { cancelled = true; };
  }, [imageAttachments, postId]);

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

  return (
    <div className={styles.attachments}>
      {imageAttachments.map((att) => (
        <div key={`img-${att.id}`} className={styles.imageFrame}>
          {imgUrls[att.id] ? (
            <img src={imgUrls[att.id]} alt={att.original_name} className={styles.imagePreview} />
          ) : (
            <div className={styles.imagePlaceholder}>이미지 로딩 중…</div>
          )}
        </div>
      ))}
      {fileAttachments.length > 0 && (
        <div className={styles.attachmentTitle}>
          첨부파일 ({fileAttachments.length})
        </div>
      )}
      {fileAttachments.map((att) => (
        <button
          key={att.id}
          type="button"
          onClick={() => handleDownload(att)}
          className={`stu-panel stu-panel--pressable ${styles.fileButton}`}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className={styles.fileIcon} aria-hidden="true">
            <path d="M10 1H4.5A1.5 1.5 0 003 2.5v13A1.5 1.5 0 004.5 17h9a1.5 1.5 0 001.5-1.5V6L10 1z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M10 1v5h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className={styles.fileInfo}>
            <div className={styles.fileName}>{att.original_name}</div>
            <div className={`stu-muted ${styles.fileSize}`}>{formatAttachmentSize(att.size_bytes)}</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={styles.downloadIcon} aria-hidden="true">
            <path d="M8 2v9M4 7l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2 12v2h12v-2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ))}
    </div>
  );
}
