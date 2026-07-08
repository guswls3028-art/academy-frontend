// 좌측 폴더 트리 — 영상: 공개 영상(맨위) + 강의명 > 1~n차시

import { useCallback, useEffect, useRef, useState } from "react";
import { FileVideo, Folder, FolderOpen } from "lucide-react";
import type { Lecture, Session } from "@/shared/api/contracts/sessions";
import type { VideoFolder } from "../api/videos.api";
import { formatSessionTreeLabel } from "@/shared/ui/session-block";
import {
  TreeBranch,
  TreeChildren,
  TreeNav,
  TreeRow,
} from "@/shared/ui/domain";

type LectureWithSessions = Lecture & { sessions?: Session[] };

export type VideoFolderId = "public" | number | null; // "public" | sessionId | folderId (음수는 폴더 ID)

type Props = {
  lectures: LectureWithSessions[];
  publicFolders?: VideoFolder[];
  currentFolderId: VideoFolderId;
  onSelectFolder: (folderId: VideoFolderId) => void;
};

function FolderTreeNode({
  folder,
  allFolders,
  currentFolderId,
  onSelectFolder,
  expandedFolderIds,
  onToggleFolder,
}: {
  folder: VideoFolder;
  allFolders: VideoFolder[];
  currentFolderId: VideoFolderId;
  onSelectFolder: (folderId: VideoFolderId) => void;
  expandedFolderIds: Set<number>;
  onToggleFolder: (folderId: number) => void;
}) {
  const children = allFolders.filter((f) => f.parent_id === folder.id);
  const folderId = -folder.id; // 음수로 폴더 ID 구분
  const isActive = currentFolderId === folderId;
  const hasChildren = children.length > 0;
  const isExpanded = expandedFolderIds.has(folder.id);

  return (
    <TreeBranch>
      <TreeRow
        label={folder.name}
        icon={isExpanded ? <FolderOpen size={16} /> : <Folder size={16} />}
        count={hasChildren ? children.length : undefined}
        expandable={hasChildren}
        expanded={isExpanded}
        active={isActive}
        selected={isActive}
        onClick={() => {
          onSelectFolder(folderId);
          if (hasChildren && isActive) {
            onToggleFolder(folder.id);
          }
        }}
      />
      {hasChildren && isExpanded && (
        <TreeChildren>
          {children.map((child) => (
            <FolderTreeNode
              key={child.id}
              folder={child}
              allFolders={allFolders}
              currentFolderId={currentFolderId}
              onSelectFolder={onSelectFolder}
              expandedFolderIds={expandedFolderIds}
              onToggleFolder={onToggleFolder}
            />
          ))}
        </TreeChildren>
      )}
    </TreeBranch>
  );
}

export default function VideoExplorerTree({
  lectures,
  publicFolders = [],
  currentFolderId,
  onSelectFolder,
}: Props) {
  const [expandedLectureIds, setExpandedLectureIds] = useState<Set<number>>(new Set());
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<number>>(new Set());
  const knownLectureIdsRef = useRef<Set<number>>(new Set());
  const knownFolderIdsRef = useRef<Set<number>>(new Set());
  const rootFolders = publicFolders.filter((f) => !f.parent_id);
  const isPublicBranch = currentFolderId === "public" || (typeof currentFolderId === "number" && currentFolderId < 0);

  useEffect(() => {
    const incomingIds = new Set(lectures.map((lecture) => lecture.id));
    setExpandedLectureIds((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const id of incomingIds) {
        if (!knownLectureIdsRef.current.has(id)) {
          next.add(id);
          changed = true;
        }
      }
      for (const id of next) {
        if (!incomingIds.has(id)) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    knownLectureIdsRef.current = incomingIds;
  }, [lectures]);

  useEffect(() => {
    const incomingIds = new Set(publicFolders.map((folder) => folder.id));
    setExpandedFolderIds((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const id of incomingIds) {
        if (!knownFolderIdsRef.current.has(id)) {
          next.add(id);
          changed = true;
        }
      }
      for (const id of next) {
        if (!incomingIds.has(id)) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    knownFolderIdsRef.current = incomingIds;
  }, [publicFolders]);

  useEffect(() => {
    if (typeof currentFolderId !== "number" || currentFolderId <= 0) return;
    const parentLecture = lectures.find((lecture) =>
      (lecture.sessions ?? []).some((session) => session.id === currentFolderId)
    );
    if (!parentLecture) return;

    setExpandedLectureIds((prev) => {
      if (prev.has(parentLecture.id)) return prev;
      const next = new Set(prev);
      next.add(parentLecture.id);
      return next;
    });
  }, [currentFolderId, lectures]);

  const toggleLecture = useCallback((lectureId: number) => {
    setExpandedLectureIds((prev) => {
      const next = new Set(prev);
      if (next.has(lectureId)) next.delete(lectureId);
      else next.add(lectureId);
      return next;
    });
  }, []);

  const toggleFolder = useCallback((folderId: number) => {
    setExpandedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }, []);

  return (
    <TreeNav ariaLabel="영상 폴더 트리">
      <TreeRow
        label="전체공개영상"
        icon={<FolderOpen size={18} />}
        count={rootFolders.length > 0 ? rootFolders.length : undefined}
        variant="hero"
        active={isPublicBranch}
        selected={currentFolderId === "public"}
        onClick={() => onSelectFolder("public")}
      />
      {isPublicBranch && rootFolders.length > 0 && (
        <TreeChildren>
          {rootFolders.map((folder) => (
            <FolderTreeNode
              key={folder.id}
              folder={folder}
              allFolders={publicFolders}
              currentFolderId={currentFolderId}
              onSelectFolder={onSelectFolder}
              expandedFolderIds={expandedFolderIds}
              onToggleFolder={toggleFolder}
            />
          ))}
        </TreeChildren>
      )}
      {lectures.map((lec) => {
        const sessions = lec.sessions ?? [];
        const isExpanded = expandedLectureIds.has(lec.id);
        const hasSelectedSession = sessions.some((session) => session.id === currentFolderId);
        const lectureLabel = lec.title || lec.name || "강의";
        return (
          <TreeBranch key={lec.id}>
            <TreeRow
              label={lectureLabel}
              icon={isExpanded ? <FolderOpen size={16} /> : <Folder size={16} />}
              count={sessions.length > 0 ? sessions.length : undefined}
              expandable={sessions.length > 0}
              expanded={isExpanded}
              active={hasSelectedSession}
              onClick={() => toggleLecture(lec.id)}
            />
            {sessions.length > 0 && isExpanded && (
              <TreeChildren>
                {sessions.map((s) => {
                  const isActive = currentFolderId === s.id;
                  return (
                    <TreeRow
                      key={s.id}
                      label={formatSessionTreeLabel(s)}
                      icon={<FileVideo size={15} />}
                      active={isActive}
                      selected={isActive}
                      onClick={() => onSelectFolder(s.id)}
                    />
                  );
                })}
              </TreeChildren>
            )}
          </TreeBranch>
        );
      })}
    </TreeNav>
  );
}
