// 좌측 폴더 트리 — 영상: 공개 영상(맨위) + 강의명 > 1~n차시

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronsDownUp, ChevronsUpDown, FileVideo, Folder, FolderOpen } from "lucide-react";
import type { Lecture, Session } from "@/shared/api/contracts/sessions";
import type { VideoFolder } from "../api/videos.api";
import { formatSessionTreeLabel } from "@/shared/ui/session-block";
import {
  TreeBranch,
  TreeChildren,
  TreeIconButton,
  TreeNav,
  TreeRow,
  TreeToolbar,
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
          if (hasChildren) {
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
  const expandableLectureIds = useMemo(
    () => lectures.filter((lecture) => (lecture.sessions ?? []).length > 0).map((lecture) => lecture.id),
    [lectures]
  );
  const totalSessionCount = useMemo(
    () => lectures.reduce((sum, lecture) => sum + (lecture.sessions ?? []).length, 0),
    [lectures]
  );
  const expandablePublicFolderIds = useMemo(() => {
    const parentIds = new Set(publicFolders.map((folder) => folder.parent_id).filter(Boolean));
    return publicFolders.filter((folder) => parentIds.has(folder.id)).map((folder) => folder.id);
  }, [publicFolders]);
  const selectedPublicFolderId =
    typeof currentFolderId === "number" && currentFolderId < 0 ? -currentFolderId : null;
  const selectedParentLectureId = useMemo(() => {
    if (typeof currentFolderId !== "number" || currentFolderId <= 0) return null;
    return lectures.find((lecture) =>
      (lecture.sessions ?? []).some((session) => session.id === currentFolderId)
    )?.id ?? null;
  }, [currentFolderId, lectures]);
  const selectedFolderPathIds = useMemo(() => {
    if (selectedPublicFolderId == null) return [];
    const byId = new Map(publicFolders.map((folder) => [folder.id, folder]));
    const path: number[] = [];
    let current = byId.get(selectedPublicFolderId);
    while (current) {
      path.unshift(current.id);
      current = current.parent_id ? byId.get(current.parent_id) : undefined;
    }
    return path;
  }, [publicFolders, selectedPublicFolderId]);

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

  const expandAll = useCallback(() => {
    setExpandedLectureIds(new Set(expandableLectureIds));
    setExpandedFolderIds(new Set(expandablePublicFolderIds));
  }, [expandableLectureIds, expandablePublicFolderIds]);

  const collapseToSelection = useCallback(() => {
    setExpandedLectureIds(selectedParentLectureId == null ? new Set() : new Set([selectedParentLectureId]));
    setExpandedFolderIds(new Set(selectedFolderPathIds));
  }, [selectedFolderPathIds, selectedParentLectureId]);

  const expandedLectureCount = expandableLectureIds.filter((id) => expandedLectureIds.has(id)).length;
  const expandedPublicFolderCount = expandablePublicFolderIds.filter((id) => expandedFolderIds.has(id)).length;
  const collapseTargetLectureCount = selectedParentLectureId == null ? 0 : 1;
  const collapseTargetFolderCount = selectedFolderPathIds.filter((id) =>
    expandablePublicFolderIds.includes(id)
  ).length;
  const allExpanded =
    expandedLectureCount === expandableLectureIds.length &&
    expandedPublicFolderCount === expandablePublicFolderIds.length;
  const collapsedToSelection =
    expandedLectureCount === collapseTargetLectureCount &&
    expandedPublicFolderCount === collapseTargetFolderCount;

  return (
    <TreeNav ariaLabel="영상 폴더 트리">
      <TreeToolbar
        meta={`${publicFolders.length}개 폴더 · ${lectures.length}개 강의 · ${totalSessionCount}개 차시`}
        actions={
          <>
            <TreeIconButton
              aria-label="전체 펼치기"
              title="전체 펼치기"
              onClick={expandAll}
              disabled={allExpanded}
            >
              <ChevronsUpDown size={15} aria-hidden />
            </TreeIconButton>
            <TreeIconButton
              aria-label="선택만 남기고 접기"
              title="선택만 남기고 접기"
              onClick={collapseToSelection}
              disabled={collapsedToSelection}
            >
              <ChevronsDownUp size={15} aria-hidden />
            </TreeIconButton>
          </>
        }
      />
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
