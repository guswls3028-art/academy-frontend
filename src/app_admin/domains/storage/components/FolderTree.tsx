// PATH: src/app_admin/domains/storage/components/FolderTree.tsx
// 재귀적 폴더 트리 — 여닫이(collapse) + 행 호버 시 액션 (이름변경/하위추가/하위포함삭제)

import { useState, useCallback } from "react";
import { FolderOpen, Folder, ChevronRight, ChevronDown, Pencil, FolderPlus, Trash2, Home } from "lucide-react";
import styles from "./FolderTree.module.css";

type FolderItem = { id: string; name: string; parentId: string | null };

type FolderTreeProps = {
  folders: FolderItem[];
  currentFolderId: string | null;
  onSelect: (folderId: string | null) => void;
  rootLabel?: string;
  // 액션 핸들러 — 셋 다 optional. 제공된 것만 호버 시 노출.
  onRename?: (folderId: string, currentName: string) => void;
  onAddChild?: (parentId: string) => void;
  onDelete?: (folderId: string, name: string) => void;
};

export default function FolderTree({
  folders,
  currentFolderId,
  onSelect,
  rootLabel = "내 저장소",
  onRename,
  onAddChild,
  onDelete,
}: FolderTreeProps) {
  const roots = folders.filter((f) => !f.parentId);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <div className={styles.root}>
      <button
        type="button"
        className={styles.item + (currentFolderId === null ? " " + styles.itemActive : "")}
        onClick={() => onSelect(null)}
      >
        <Home size={14} className={styles.icon} />
        <span className={styles.itemLabel}>{rootLabel}</span>
        <span className={styles.itemCount}>{folders.length}</span>
      </button>
      {roots.map((folder) => (
        <TreeNode
          key={folder.id}
          folder={folder}
          allFolders={folders}
          currentFolderId={currentFolderId}
          onSelect={onSelect}
          collapsed={collapsed}
          onToggle={toggle}
          depth={0}
          onRename={onRename}
          onAddChild={onAddChild}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

function TreeNode({
  folder,
  allFolders,
  currentFolderId,
  onSelect,
  collapsed,
  onToggle,
  depth,
  onRename,
  onAddChild,
  onDelete,
}: {
  folder: FolderItem;
  allFolders: FolderItem[];
  currentFolderId: string | null;
  onSelect: (folderId: string | null) => void;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  depth: number;
  onRename?: (folderId: string, currentName: string) => void;
  onAddChild?: (parentId: string) => void;
  onDelete?: (folderId: string, name: string) => void;
}) {
  const children = allFolders.filter((f) => f.parentId === folder.id);
  const isActive = currentFolderId === folder.id;
  const hasChildren = children.length > 0;
  const isCollapsed = collapsed.has(folder.id);
  const hasActions = !!(onRename || onAddChild || onDelete);

  return (
    <div className={styles.node}>
      <div className={styles.itemRow}>
        {hasChildren ? (
          <button
            type="button"
            className={styles.toggleBtn}
            onClick={(e) => { e.stopPropagation(); onToggle(folder.id); }}
            aria-label={isCollapsed ? "펼치기" : "접기"}
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </button>
        ) : (
          <span className={styles.toggleSpacer} />
        )}
        <button
          type="button"
          className={styles.item + (isActive ? " " + styles.itemActive : "")}
          onClick={() => onSelect(folder.id)}
          title={folder.name}
        >
          {isCollapsed ? (
            <Folder size={14} className={styles.icon} />
          ) : (
            <FolderOpen size={14} className={styles.icon} />
          )}
          <span className={styles.itemLabel}>{folder.name}</span>
          {hasChildren && (
            <span className={styles.itemCount}>{children.length}</span>
          )}
        </button>
        {hasActions && (
          <span className={styles.actions} role="group" aria-label="폴더 액션">
            {onAddChild && (
              <button
                type="button"
                className={styles.actionBtn}
                onClick={(e) => { e.stopPropagation(); onAddChild(folder.id); }}
                title="하위 폴더 만들기"
                aria-label="하위 폴더 만들기"
              >
                <FolderPlus size={13} />
              </button>
            )}
            {onRename && (
              <button
                type="button"
                className={styles.actionBtn}
                onClick={(e) => { e.stopPropagation(); onRename(folder.id, folder.name); }}
                title="이름 변경"
                aria-label="이름 변경"
              >
                <Pencil size={13} />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                className={styles.actionBtn + " " + styles.actionDanger}
                onClick={(e) => { e.stopPropagation(); onDelete(folder.id, folder.name); }}
                title="하위 포함 삭제"
                aria-label="하위 포함 삭제"
              >
                <Trash2 size={13} />
              </button>
            )}
          </span>
        )}
      </div>
      {hasChildren && !isCollapsed && (
        <div className={styles.children} style={{ "--depth": depth + 1 } as React.CSSProperties}>
          {children.map((child) => (
            <TreeNode
              key={child.id}
              folder={child}
              allFolders={allFolders}
              currentFolderId={currentFolderId}
              onSelect={onSelect}
              collapsed={collapsed}
              onToggle={onToggle}
              depth={depth + 1}
              onRename={onRename}
              onAddChild={onAddChild}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
