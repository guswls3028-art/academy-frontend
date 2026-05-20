// PATH: src/app_admin/domains/storage/components/matchup/DocumentPreviewModal.tsx
// 매치업 원본 PDF/이미지 미리보기 모달
//
// PDF: iframe → 브라우저 native viewer
// 이미지: img 태그 + 비율 유지
// ESC 키 닫기, 배경 클릭 닫기, 새 창 열기 버튼

import { useEffect, useState } from "react";
import { X, ExternalLink, Loader2, AlertCircle } from "lucide-react";
import { ICON } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { getMatchupDocumentPreview } from "../../api/matchup.api";
import type { MatchupDocumentPreview } from "../../api/matchup.api";
import styles from "./DocumentPreviewModal.module.css";

type Props = {
  documentId: number;
  documentTitle: string;
  onClose: () => void;
};

export default function DocumentPreviewModal({ documentId, documentTitle, onClose }: Props) {
  const [preview, setPreview] = useState<MatchupDocumentPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPreview(null);
    getMatchupDocumentPreview(documentId)
      .then((p) => {
        if (!cancelled) setPreview(p);
      })
      .catch(() => {
        if (cancelled) return;
        setError("미리보기를 불러올 수 없습니다.");
        feedback.error("미리보기를 불러올 수 없습니다.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isPdf = preview?.content_type === "application/pdf";
  const isImage = preview?.content_type?.startsWith("image/");

  return (
    <div
      data-testid="matchup-preview-modal"
      onClick={onClose}
      className={styles.backdrop}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={styles.modal}
      >
        {/* 헤더 */}
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            <h3 className={styles.title}>
              {documentTitle}
            </h3>
            {preview && (
              <span className={styles.typeBadge}>
                {isPdf ? "PDF" : isImage ? "이미지" : preview.content_type}
              </span>
            )}
          </div>
          <div className={styles.actions}>
            {preview?.url && (
              <a
                href={preview.url}
                target="_blank"
                rel="noopener noreferrer"
                title="새 창에서 열기"
                className={styles.openLink}
              >
                <ExternalLink size={ICON.sm} />
                새 창
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              title="닫기 (ESC)"
              className={styles.closeButton}
            >
              <X size={ICON.md} />
            </button>
          </div>
        </div>

        {/* 본문 */}
        <div className={styles.body}>
          {loading && (
            <div className={styles.stateLayer} data-tone="muted">
              <Loader2 size={ICON.lg} className={`${styles.loadingIcon} animate-spin`} />
              <span className={styles.loadingText}>미리보기 불러오는 중...</span>
            </div>
          )}
          {error && !loading && (
            <div className={styles.stateLayer} data-tone="danger">
              <AlertCircle size={ICON.xl} />
              <span className={styles.errorText}>{error}</span>
            </div>
          )}
          {preview && !loading && !error && (
            <>
              {isPdf && (
                <iframe
                  src={preview.url}
                  title={preview.title}
                  className={styles.previewFrame}
                />
              )}
              {isImage && (
                <div className={styles.imageWrap}>
                  <img
                    src={preview.url}
                    alt={preview.title}
                    className={styles.previewImage}
                  />
                </div>
              )}
              {!isPdf && !isImage && (
                <div className={styles.unsupported}>
                  미리보기를 지원하지 않는 형식입니다 ({preview.content_type}).
                  새 창으로 열어주세요.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
