// PATH: src/features/tools/ppt/components/SortableImageGrid.tsx
// 드래그 앤 드롭 이미지 정렬 그리드 — 순수 HTML5 DnD (라이브러리 미사용)

import { useState, useRef, useCallback, useEffect, useMemo } from "react";

export interface ImageItem {
  id: string;
  file: File;
  previewUrl: string;
  /** 슬라이드별 반전 설정 */
  invert?: boolean;
}

interface SortableImageGridProps {
  items: ImageItem[];
  onReorder: (items: ImageItem[]) => void;
  onRemove: (id: string) => void;
  onToggleInvert: (id: string) => void;
  disabled?: boolean;
}

export default function SortableImageGrid({
  items,
  onReorder,
  onRemove,
  onToggleInvert,
  disabled,
}: SortableImageGridProps) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const dragRef = useRef<number | null>(null);

  const handleDragStart = (idx: number) => (e: React.DragEvent) => {
    if (disabled) return;
    dragRef.current = idx;
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = "move";
    // 투명도 설정을 위해 drag image 커스터마이징
    if (e.currentTarget instanceof HTMLElement) {
      e.dataTransfer.setDragImage(e.currentTarget, 60, 60);
    }
  };

  const handleDragOver = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOverIdx(idx);
  };

  const handleDrop = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    const from = dragRef.current;
    if (from === null || from === idx) {
      setDragIdx(null);
      setOverIdx(null);
      return;
    }
    const newItems = [...items];
    const [moved] = newItems.splice(from, 1);
    newItems.splice(idx, 0, moved);
    onReorder(newItems);
    setDragIdx(null);
    setOverIdx(null);
    dragRef.current = null;
  };

  const handleDragEnd = () => {
    setDragIdx(null);
    setOverIdx(null);
    dragRef.current = null;
  };

  if (items.length === 0) return null;

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
      }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)" }}>
          슬라이드 ({items.length}장)
        </span>
        <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
          드래그하여 순서 변경
        </span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
          gap: 12,
        }}
      >
        {items.map((item, idx) => (
          <div
            key={item.id}
            draggable={!disabled}
            onDragStart={handleDragStart(idx)}
            onDragOver={handleDragOver(idx)}
            onDrop={handleDrop(idx)}
            onDragEnd={handleDragEnd}
            style={{
              position: "relative",
              borderRadius: "var(--radius-md, 8px)",
              border: overIdx === idx
                ? "2px solid var(--color-primary)"
                : "1px solid var(--color-border-divider)",
              overflow: "hidden",
              cursor: disabled ? "default" : "grab",
              opacity: dragIdx === idx ? 0.4 : 1,
              transition: "opacity 0.15s, border-color 0.15s",
              background: "var(--bg-surface)",
            }}
          >
            {/* 슬라이드 번호 */}
            <div style={{
              position: "absolute",
              top: 6,
              left: 6,
              background: "rgba(0,0,0,0.7)",
              color: "#fff",
              fontSize: 11,
              fontWeight: 700,
              padding: "2px 7px",
              borderRadius: 4,
              zIndex: 2,
            }}>
              {idx + 1}
            </div>

            {/* 반전 토글 버튼 */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleInvert(item.id); }}
              title={item.invert ? "반전 해제" : "흑백 반전"}
              style={{
                position: "absolute",
                top: 6,
                right: 34,
                width: 24,
                height: 24,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: item.invert ? "var(--color-primary)" : "rgba(0,0,0,0.5)",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                zIndex: 2,
                fontSize: 12,
                fontWeight: 700,
                padding: 0,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2v20" />
                <path d="M12 2a10 10 0 0 1 0 20" fill="currentColor" />
              </svg>
            </button>

            {/* 삭제 버튼 */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemove(item.id); }}
              title="삭제"
              style={{
                position: "absolute",
                top: 6,
                right: 6,
                width: 24,
                height: 24,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(220,38,38,0.85)",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                zIndex: 2,
                fontSize: 14,
                fontWeight: 700,
                lineHeight: 1,
                padding: 0,
              }}
            >
              &times;
            </button>

            {/* 이미지 미리보기 */}
            <div style={{
              aspectRatio: "16/9",
              background: "#1a1a1a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}>
              <img
                src={item.previewUrl}
                alt={`Slide ${idx + 1}`}
                loading="lazy"
                style={{
                  maxWidth: "100%",
                  maxHeight: "100%",
                  objectFit: "contain",
                  filter: item.invert ? "invert(1)" : "none",
                  transition: "filter 0.2s",
                }}
              />
            </div>

            {/* 파일명 */}
            <div style={{
              padding: "6px 8px",
              fontSize: 11,
              color: "var(--color-text-muted)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}>
              {item.file.name}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
