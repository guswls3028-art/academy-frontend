// PATH: src/app_admin/domains/tools/ppt/components/SortableImageGrid.tsx
// 드래그 앤 드롭 이미지 정렬 그리드 — 순수 HTML5 DnD (라이브러리 미사용)

import { useState, useRef } from "react";
import styles from "./SortableImageGrid.module.css";

type SortMode = "nameAsc" | "nameDesc" | "oldest" | "newest" | "upload" | "manual";

export interface ImageItem {
  id: string;
  addedSeq?: number;
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
  sortMode: SortMode;
  onSortModeChange: (mode: SortMode) => void;
  disabled?: boolean;
}

export default function SortableImageGrid({
  items,
  onReorder,
  onRemove,
  onToggleInvert,
  sortMode,
  onSortModeChange,
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
    <div className={styles.root}>
      <div className={styles.header}>
        <span className={styles.title}>
          슬라이드 ({items.length}장)
        </span>
        <div className={styles.headerControls}>
          <label className={styles.sortLabel}>
            정렬
            <select
              value={sortMode}
              onChange={(e) => onSortModeChange(e.target.value as SortMode)}
              disabled={disabled}
              className={styles.sortSelect}
            >
              <option value="nameAsc">파일명 1→9</option>
              <option value="nameDesc">파일명 9→1</option>
              <option value="oldest">오래된 순</option>
              <option value="newest">최신 순</option>
              <option value="upload">업로드 순</option>
              <option value="manual">직접 정렬</option>
            </select>
          </label>
          <span className={styles.hint}>
            드래그하여 순서 변경
          </span>
        </div>
      </div>
      <div className={styles.grid}>
        {items.map((item, idx) => (
          <div
            key={item.id}
            draggable={!disabled}
            onDragStart={handleDragStart(idx)}
            onDragOver={handleDragOver(idx)}
            onDrop={handleDrop(idx)}
            onDragEnd={handleDragEnd}
            className={styles.item}
            data-over={overIdx === idx ? "true" : "false"}
            data-dragging={dragIdx === idx ? "true" : "false"}
            data-disabled={disabled ? "true" : "false"}
          >
            {/* 슬라이드 번호 */}
            <div className={styles.slideNumber}>
              {idx + 1}
            </div>

            {/* 반전 토글 버튼 */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleInvert(item.id); }}
              title={item.invert ? "반전 해제" : "흑백 반전"}
              className={`${styles.iconButton} ${styles.invertButton}`}
              data-invert={item.invert ? "true" : "false"}
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
              className={`${styles.iconButton} ${styles.removeButton}`}
            >
              &times;
            </button>

            {/* 이미지 미리보기 */}
            <div className={styles.imageFrame}>
              <img
                src={item.previewUrl}
                alt={`Slide ${idx + 1}`}
                loading="lazy"
                className={styles.previewImage}
                data-invert={item.invert ? "true" : "false"}
              />
            </div>

            {/* 파일명 */}
            <div className={styles.filename}>
              {item.file.name}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
