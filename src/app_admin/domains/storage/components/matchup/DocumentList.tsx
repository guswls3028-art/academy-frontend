// PATH: src/app_admin/domains/storage/components/matchup/DocumentList.tsx
// 좌측 문서 목록 패널

import { FileText, Plus, Loader2, AlertCircle, CheckCircle2, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/shared/ui/ds";
import { useConfirm } from "@/shared/ui/confirm";
import type { MatchupDocument, SegmentationMethod } from "../../api/matchup.api";
import type { DocProgressMap } from "../../hooks/useMatchupPolling";
import css from "@/shared/ui/domain/PanelWithTreeLayout.module.css";

type Props = {
  documents: MatchupDocument[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onUpload: () => void;
  onDelete: (id: number) => void;
  onRetry: (id: number) => void;
  progressMap?: DocProgressMap;
};

const STATUS_ICON = {
  pending: <Loader2 size={14} style={{ color: "var(--color-text-muted)" }} />,
  processing: <Loader2 size={14} className="animate-spin" style={{ color: "var(--color-brand-primary)" }} />,
  done: <CheckCircle2 size={14} style={{ color: "var(--color-success)" }} />,
  failed: <AlertCircle size={14} style={{ color: "var(--color-danger)" }} />,
} as const;

const STATUS_LABEL = {
  pending: "대기",
  processing: "처리 중",
  done: "",
  failed: "실패",
} as const;

// 세그멘테이션 방식별 라벨 + 색상
// text: PDF 텍스트 직접 추출 (가장 깔끔)
// ocr : 스캔 PDF OCR 추출
// mixed: 텍스트+스캔 혼합
// image: 단일 이미지 업로드
// none: 문제 검출 실패 — 전체 페이지로 대체
const SEG_META: Record<SegmentationMethod, { label: string; color: string; tip: string }> = {
  text: { label: "텍스트", color: "var(--color-success)", tip: "PDF 텍스트 직접 추출" },
  ocr: { label: "OCR", color: "var(--color-brand-primary)", tip: "스캔본 OCR로 텍스트 추출" },
  mixed: { label: "혼합", color: "var(--color-brand-primary)", tip: "텍스트 + OCR 혼합 추출" },
  image: { label: "이미지", color: "var(--color-text-secondary)", tip: "단일 이미지 업로드" },
  none: { label: "미검출", color: "var(--color-warning)", tip: "문제 영역을 못 찾음 — 페이지 단위로 처리됨" },
};

export default function DocumentList({
  documents, selectedId, onSelect, onUpload, onDelete, onRetry,
  progressMap = {},
}: Props) {
  const confirm = useConfirm();

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    const ok = await confirm({
      title: "문서 삭제",
      message: "이 문서와 추출된 문제가 모두 삭제됩니다.",
      confirmText: "삭제",
      danger: true,
    });
    if (ok) onDelete(id);
  };

  const handleRetry = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    onRetry(id);
  };

  return (
    <>
      <div className={css.treeNavHeader}>
        <span className={css.treeNavTitle}>문서 목록</span>
        <div style={{ marginLeft: "auto" }}>
          <Button intent="ghost" size="sm" onClick={onUpload} data-testid="matchup-upload-button">
            <Plus size={14} />
          </Button>
        </div>
      </div>

      <div className={css.treeScroll}>
        {documents.length === 0 && (
          <div style={{ padding: "var(--space-6) var(--space-4)", textAlign: "center" }}>
            <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: 0 }}>
              업로드된 문서가 없습니다
            </p>
          </div>
        )}

        {documents.map((doc) => {
          const segMethod = doc.meta?.segmentation_method;
          const segInfo = segMethod ? SEG_META[segMethod] : null;
          const progress = progressMap[doc.id];
          const isSelected = selectedId === doc.id;

          return (
            <div
              key={doc.id}
              data-testid="matchup-doc-row"
              data-doc-id={doc.id}
              onClick={() => onSelect(doc.id)}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "var(--space-2)",
                padding: "var(--space-3) var(--space-4)",
                cursor: "pointer",
                borderRadius: "var(--radius-md)",
                margin: "0 var(--space-2)",
                background: isSelected
                  ? "color-mix(in srgb, var(--color-brand-primary) 8%, var(--color-bg-surface))"
                  : undefined,
                borderLeft: isSelected
                  ? "3px solid var(--color-brand-primary)"
                  : "3px solid transparent",
                transition: "background 0.15s, border-color 0.15s",
              }}
            >
              <FileText size={16} style={{ color: "var(--color-text-muted)", marginTop: 2, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  title={doc.title}
                  style={{
                    fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)",
                    overflow: "hidden", textOverflow: "ellipsis",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    wordBreak: "break-all",
                    lineHeight: 1.3,
                  }}
                >
                  {doc.title}
                </div>

                {/* 상태 + 문제 수 + 과목 뱃지 */}
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1)", marginTop: 2, flexWrap: "wrap" }}>
                  {STATUS_ICON[doc.status]}
                  <span
                    style={{ fontSize: 11, color: "var(--color-text-muted)" }}
                    title={doc.status === "failed" ? doc.error_message || "처리 실패" : undefined}
                  >
                    {doc.status === "done"
                      ? `${doc.problem_count}문제`
                      : doc.status === "processing" && progress && progress.percent > 0
                        ? `${progress.stepName} ${Math.round(progress.percent)}%`
                        : STATUS_LABEL[doc.status]}
                  </span>

                  {/* 세그멘테이션 방식 뱃지 (done에서만 표시) */}
                  {doc.status === "done" && segInfo && (
                    <span
                      title={segInfo.tip}
                      style={{
                        fontSize: 10,
                        padding: "1px 6px",
                        borderRadius: 4,
                        background: `color-mix(in srgb, ${segInfo.color} 12%, transparent)`,
                        color: segInfo.color,
                        fontWeight: 600,
                      }}
                    >
                      {segInfo.label}
                    </span>
                  )}

                  {doc.subject && (
                    <span
                      title="과목"
                      style={{
                        fontSize: 10, padding: "1px 6px", borderRadius: 4,
                        // 진행률(파란색)/세그멘테이션(색상별)과 구분되는 뉴트럴 그레이
                        background: "var(--color-bg-surface-soft)",
                        color: "var(--color-text-secondary)",
                        border: "1px solid var(--color-border-divider)",
                      }}
                    >
                      {doc.subject}
                    </span>
                  )}
                </div>

                {/* 진행률 바 (processing 상태) */}
                {doc.status === "processing" && progress && (
                  <div
                    style={{
                      marginTop: 6,
                      height: 3,
                      borderRadius: 2,
                      background: "var(--color-bg-surface-soft)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      data-testid="matchup-progress-bar"
                      style={{
                        width: `${Math.min(100, Math.max(0, progress.percent))}%`,
                        height: "100%",
                        background: "var(--color-brand-primary)",
                        transition: "width 0.3s",
                      }}
                    />
                  </div>
                )}
              </div>

              {/* 액션 버튼 */}
              <div style={{ display: "flex", gap: 2, flexShrink: 0, marginTop: 2 }}>
                {doc.status === "failed" && (
                  <button
                    onClick={(e) => handleRetry(e, doc.id)}
                    title="재시도"
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", padding: 2 }}
                  >
                    <RefreshCw size={13} />
                  </button>
                )}
                <button
                  onClick={(e) => handleDelete(e, doc.id)}
                  title="삭제"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", padding: 2 }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
