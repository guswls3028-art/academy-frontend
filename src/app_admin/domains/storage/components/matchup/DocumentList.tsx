// PATH: src/app_admin/domains/storage/components/matchup/DocumentList.tsx
// 좌측 문서 목록 패널

import { FileText, Plus, Loader2, AlertCircle, CheckCircle2, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/shared/ui/ds";
import { useConfirm } from "@/shared/ui/confirm";
import type { MatchupDocument } from "../../api/matchup.api";
import css from "@/shared/ui/domain/PanelWithTreeLayout.module.css";

type Props = {
  documents: MatchupDocument[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onUpload: () => void;
  onDelete: (id: number) => void;
  onRetry: (id: number) => void;
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

export default function DocumentList({
  documents, selectedId, onSelect, onUpload, onDelete, onRetry,
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
          <Button intent="ghost" size="sm" onClick={onUpload}>
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

        {documents.map((doc) => (
          <div
            key={doc.id}
            onClick={() => onSelect(doc.id)}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "var(--space-2)",
              padding: "var(--space-3) var(--space-4)",
              cursor: "pointer",
              borderRadius: "var(--radius-md)",
              margin: "0 var(--space-2)",
              background: selectedId === doc.id
                ? "color-mix(in srgb, var(--color-brand-primary) 8%, var(--color-bg-surface))"
                : undefined,
              borderLeft: selectedId === doc.id
                ? "3px solid var(--color-brand-primary)"
                : "3px solid transparent",
              transition: "background 0.15s, border-color 0.15s",
            }}
          >
            <FileText size={16} style={{ color: "var(--color-text-muted)", marginTop: 2, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {doc.title}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1)", marginTop: 2 }}>
                {STATUS_ICON[doc.status]}
                <span
                  style={{ fontSize: 11, color: "var(--color-text-muted)" }}
                  title={doc.status === "failed" ? doc.error_message || "처리 실패" : undefined}
                >
                  {doc.status === "done"
                    ? `${doc.problem_count}문제`
                    : STATUS_LABEL[doc.status]}
                </span>
                {doc.subject && (
                  <span style={{
                    fontSize: 10, padding: "1px 6px", borderRadius: 4,
                    background: "var(--color-bg-surface-soft)", color: "var(--color-text-muted)",
                    marginLeft: "var(--space-1)",
                  }}>
                    {doc.subject}
                  </span>
                )}
              </div>
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
        ))}
      </div>
    </>
  );
}
