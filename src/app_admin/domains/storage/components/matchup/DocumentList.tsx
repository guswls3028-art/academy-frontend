// PATH: src/app_admin/domains/storage/components/matchup/DocumentList.tsx
// 좌측 문서 목록 패널
//
// 검색 + 상태 필터 + 정렬 추가. 500개 누적 시 탐색 가능하도록.

import { useMemo, useState } from "react";
import { FileText, Plus, Loader2, AlertCircle, CheckCircle2, RefreshCw, Trash2, Search, X } from "lucide-react";
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

type StatusFilter = "all" | "processing" | "done" | "failed";

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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return documents.filter((d) => {
      if (statusFilter !== "all") {
        if (statusFilter === "processing" && !(d.status === "processing" || d.status === "pending")) return false;
        if (statusFilter === "done" && d.status !== "done") return false;
        if (statusFilter === "failed" && d.status !== "failed") return false;
      }
      if (!q) return true;
      return (
        d.title.toLowerCase().includes(q) ||
        d.subject.toLowerCase().includes(q) ||
        d.grade_level.toLowerCase().includes(q)
      );
    });
  }, [documents, search, statusFilter]);

  const counts = useMemo(() => ({
    all: documents.length,
    processing: documents.filter((d) => d.status === "processing" || d.status === "pending").length,
    done: documents.filter((d) => d.status === "done").length,
    failed: documents.filter((d) => d.status === "failed").length,
  }), [documents]);

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

  const filterBtnStyle = (active: boolean): React.CSSProperties => ({
    background: active ? "color-mix(in srgb, var(--color-brand-primary) 12%, transparent)" : "transparent",
    border: "1px solid",
    borderColor: active ? "var(--color-brand-primary)" : "var(--color-border-divider)",
    color: active ? "var(--color-brand-primary)" : "var(--color-text-secondary)",
    fontSize: 11,
    fontWeight: 600,
    padding: "3px 8px",
    borderRadius: 4,
    cursor: "pointer",
  });

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

      {/* 검색 + 필터 */}
      {documents.length > 0 && (
        <div style={{
          padding: "var(--space-2) var(--space-3)",
          borderBottom: "1px solid var(--color-border-divider)",
          display: "flex", flexDirection: "column", gap: 6,
        }}>
          <div style={{ position: "relative" }}>
            <Search
              size={12}
              style={{
                position: "absolute",
                left: 8, top: "50%", transform: "translateY(-50%)",
                color: "var(--color-text-muted)", pointerEvents: "none",
              }}
            />
            <input
              data-testid="matchup-doc-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="제목·과목·학년 검색"
              style={{
                width: "100%",
                padding: "5px 26px 5px 24px",
                border: "1px solid var(--color-border-divider)",
                borderRadius: 6,
                fontSize: 12,
                background: "var(--color-bg-surface)",
                color: "var(--color-text-primary)",
                outline: "none",
              }}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                style={{
                  position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--color-text-muted)", padding: 2, display: "flex",
                }}
                title="지우기"
              >
                <X size={12} />
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            <button style={filterBtnStyle(statusFilter === "all")} onClick={() => setStatusFilter("all")}>
              전체 {counts.all}
            </button>
            <button style={filterBtnStyle(statusFilter === "processing")} onClick={() => setStatusFilter("processing")}>
              처리중 {counts.processing}
            </button>
            <button style={filterBtnStyle(statusFilter === "done")} onClick={() => setStatusFilter("done")}>
              완료 {counts.done}
            </button>
            <button
              style={{
                ...filterBtnStyle(statusFilter === "failed"),
                ...(counts.failed > 0 && statusFilter !== "failed" ? {
                  borderColor: "color-mix(in srgb, var(--color-danger) 40%, var(--color-border-divider))",
                  color: "var(--color-danger)",
                } : {}),
              }}
              onClick={() => setStatusFilter("failed")}
            >
              실패 {counts.failed}
            </button>
          </div>
        </div>
      )}

      <div className={css.treeScroll}>
        {documents.length === 0 && (
          <div style={{ padding: "var(--space-6) var(--space-4)", textAlign: "center" }}>
            <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: 0 }}>
              업로드된 문서가 없습니다
            </p>
          </div>
        )}

        {documents.length > 0 && filtered.length === 0 && (
          <div style={{ padding: "var(--space-5) var(--space-4)", textAlign: "center" }}>
            <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: 0 }}>
              조건에 맞는 문서가 없습니다
            </p>
          </div>
        )}

        {filtered.map((doc) => {
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
                  : doc.status === "failed"
                    ? "color-mix(in srgb, var(--color-danger) 4%, transparent)"
                    : undefined,
                borderLeft: isSelected
                  ? "3px solid var(--color-brand-primary)"
                  : doc.status === "failed"
                    ? "3px solid color-mix(in srgb, var(--color-danger) 40%, transparent)"
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

                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1)", marginTop: 2, flexWrap: "wrap" }}>
                  {STATUS_ICON[doc.status]}
                  <span
                    style={{
                      fontSize: 11,
                      color: doc.status === "failed" ? "var(--color-danger)" : "var(--color-text-muted)",
                      fontWeight: doc.status === "failed" ? 600 : 400,
                    }}
                    title={doc.status === "failed" ? doc.error_message || "처리 실패" : undefined}
                  >
                    {doc.status === "done"
                      ? `${doc.problem_count}문제`
                      : doc.status === "processing" && progress && progress.percent > 0
                        ? `${progress.stepName} ${Math.round(progress.percent)}%`
                        : STATUS_LABEL[doc.status]}
                  </span>

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
                        background: "var(--color-bg-surface-soft)",
                        color: "var(--color-text-secondary)",
                        border: "1px solid var(--color-border-divider)",
                      }}
                    >
                      {doc.subject}
                    </span>
                  )}
                </div>

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

              <div style={{ display: "flex", gap: 2, flexShrink: 0, marginTop: 2 }}>
                {doc.status === "failed" && (
                  <button
                    onClick={(e) => handleRetry(e, doc.id)}
                    title="재시도"
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-danger)", padding: 2 }}
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
