// PATH: src/features/storage/components/FolderTree.tsx
// 재귀적 폴더 트리

import { FolderOpen } from "lucide-react";
import styles from "./FolderTree.module.css";

type Folder = { id: string; name: string; parentId: string | null };

type FolderTreeProps = {
  folders: Folder[];
  currentFolderId: string | null;
  onSelect: (folderId: string | null) => void;
};

export default function FolderTree({
  folders,
  currentFolderId,
  onSelect,
}: FolderTreeProps) {
  const roots = folders.filter((f) => !f.parentId);
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
}: {
  folder: Folder;
  allFolders: Folder[];
  currentFolderId: string | null;
  onSelect: (folderId: string | null) => void;
}) {
  const children = allFolders.filter((f) => f.parentId === folder.id);
  const isActive = currentFolderId === folder.id;

  return (
    <div className={styles.node}>
      <button
        type="button"
        className={styles.item + (isActive ? " " + styles.itemActive : "")}
        onClick={() => onSelect(folder.id)}
      >
        <FolderOpen size={16} />
        <span>{folder.name}</span>
      </button>
      {children.length > 0 && (
        <div className={styles.children}>
          {children.map((child) => (
            <TreeNode
              key={child.id}
              folder={child}
              allFolders={allFolders}
              currentFolderId={currentFolderId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
