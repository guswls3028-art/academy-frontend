// 좌측 폴더 트리 — 영상: 전체공개영상(맨위) + 강의명 > 1~n차시

import { FolderOpen } from "lucide-react";
import type { Lecture } from "@/features/lectures/api/sessions";
import type { Session } from "@/features/lectures/api/sessions";
import type { VideoFolder } from "../api/videos";
import styles from "./VideoExplorerTree.module.css";

type LectureWithSessions = Lecture & { sessions?: Session[] };

export type VideoFolderId = "public" | number | null; // "public" | sessionId | folderId (음수는 폴더 ID)

type Props = {
  lectures: LectureWithSessions[];
  publicFolders?: VideoFolder[];
  currentFolderId: VideoFolderId;
  onSelectFolder: (folderId: VideoFolderId) => void;
};

function formatSessionTitle(s: Session): string {
  const order = s.order ?? 0;
  const date = s.date ? new Date(s.date).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" }) : "";
  return date ? `${order}차시 ${date}` : `${order}차시`;
}

function FolderTreeNode({
  folder,
  allFolders,
  currentFolderId,
  onSelectFolder,
  level = 0,
}: {
  folder: VideoFolder;
  allFolders: VideoFolder[];
  currentFolderId: VideoFolderId;
  onSelectFolder: (folderId: VideoFolderId) => void;
  level?: number;
}) {
  const children = allFolders.filter((f) => f.parent_id === folder.id);
  const folderId = -folder.id; // 음수로 폴더 ID 구분
  const isActive = currentFolderId === folderId;

  return (
    <div className={styles.node}>
      <button
        type="button"
        className={styles.item + (isActive ? " " + styles.itemActive : "")}
        onClick={() => onSelectFolder(folderId)}
        style={{ marginLeft: `${level * 16}px` }}
      >
        <FolderOpen size={16} aria-hidden />
        <span>{folder.name}</span>
      </button>
      {children.length > 0 && (
        <div className={styles.children}>
          {children.map((child) => (
            <FolderTreeNode
              key={child.id}
              folder={child}
              allFolders={allFolders}
              currentFolderId={currentFolderId}
              onSelectFolder={onSelectFolder}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function VideoExplorerTree({
  lectures,
  publicFolders = [],
  currentFolderId,
  onSelectFolder,
}: Props) {
  const rootFolders = publicFolders.filter((f) => !f.parent_id);

  return (
    <div className={styles.root}>
      <button
        type="button"
        className={
          styles.item +
          " " +
          styles.itemPublic +
          (currentFolderId === "public" ? " " + styles.itemActive : "")
        }
        onClick={() => onSelectFolder("public")}
      >
        <FolderOpen size={20} aria-hidden />
        <span>전체공개영상</span>
      </button>
      {currentFolderId === "public" && rootFolders.length > 0 && (
        <div className={styles.children}>
          {rootFolders.map((folder) => (
            <FolderTreeNode
              key={folder.id}
              folder={folder}
              allFolders={publicFolders}
              currentFolderId={currentFolderId}
              onSelectFolder={onSelectFolder}
            />
          ))}
        </div>
      )}
      {lectures.map((lec) => {
        const sessions = lec.sessions ?? [];
        return (
          <div key={lec.id} className={styles.node}>
            <div className={styles.lectureLabel}>
              <FolderOpen size={16} aria-hidden />
              <span>{lec.title || lec.name || "강의"}</span>
            </div>
            {sessions.length > 0 && (
              <div className={styles.children}>
                {sessions.map((s) => {
                  const isActive = currentFolderId === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className={styles.item + (isActive ? " " + styles.itemActive : "")}
                      onClick={() => onSelectFolder(s.id)}
                    >
                      <FolderOpen size={16} aria-hidden />
                      <span>{formatSessionTitle(s)}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
