// PATH: src/features/storage/components/FolderTree.tsx
// 재귀적 폴더 트리 — 여닫이(collapse) 지원

import { useState, useCallback } from "react";
import { FolderOpen, Folder, ChevronRight, ChevronDown } from "lucide-react";
import styles from "./FolderTree.module.css";

type FolderItem = { id: string; name: string; parentId: string | null };

type FolderTreeProps = {
  folders: FolderItem[];
  currentFolderId: string | null;
  onSelect: (folderId: string | null) => void;
};

export default function FolderTree({
  folders,
  currentFolderId,
  onSelect,
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
        <FolderOpen size={16} />
        <span>내 저장소</span>
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
}: {
  folder: FolderItem;
  allFolders: FolderItem[];
  currentFolderId: string | null;
  onSelect: (folderId: string | null) => void;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
}) {
  const children = allFolders.filter((f) => f.parentId === folder.id);
  const isActive = currentFolderId === folder.id;
  const hasChildren = children.length > 0;
  const isCollapsed = collapsed.has(folder.id);

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
        >
          {isCollapsed ? <Folder size={16} /> : <FolderOpen size={16} />}
          <span>{folder.name}</span>
        </button>
      </div>
      {hasChildren && !isCollapsed && (
        <div className={styles.children}>
          {children.map((child) => (
            <TreeNode
              key={child.id}
              folder={child}
              allFolders={allFolders}
              currentFolderId={currentFolderId}
              onSelect={onSelect}
              collapsed={collapsed}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}
