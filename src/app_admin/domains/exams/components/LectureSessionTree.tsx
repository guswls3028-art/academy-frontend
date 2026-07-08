// 좌측 폴더 트리 — 시험/성적 공통: 강의명 > 1~n차시

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronsDownUp, ChevronsUpDown, FileText, Folder, FolderOpen } from "lucide-react";
import type { Lecture, Session } from "@/shared/api/contracts/sessions";
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

type Props = {
  lectures: LectureWithSessions[];
  currentSessionId: number | null;
  onSelectSession: (sessionId: number | null) => void;
};

export default function LectureSessionTree({
  lectures,
  currentSessionId,
  onSelectSession,
}: Props) {
  const [expandedLectureIds, setExpandedLectureIds] = useState<Set<number>>(new Set());
  const knownLectureIdsRef = useRef<Set<number>>(new Set());
  const expandableLectureIds = useMemo(
    () => lectures.filter((lecture) => (lecture.sessions ?? []).length > 0).map((lecture) => lecture.id),
    [lectures]
  );
  const totalSessionCount = useMemo(
    () => lectures.reduce((sum, lecture) => sum + (lecture.sessions ?? []).length, 0),
    [lectures]
  );
  const selectedParentLectureId = useMemo(() => {
    if (currentSessionId == null) return null;
    return lectures.find((lecture) =>
      (lecture.sessions ?? []).some((session) => session.id === currentSessionId)
    )?.id ?? null;
  }, [currentSessionId, lectures]);

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
    if (currentSessionId == null) return;
    const parentLecture = lectures.find((lecture) =>
      (lecture.sessions ?? []).some((session) => session.id === currentSessionId)
    );
    if (!parentLecture) return;

    setExpandedLectureIds((prev) => {
      if (prev.has(parentLecture.id)) return prev;
      const next = new Set(prev);
      next.add(parentLecture.id);
      return next;
    });
  }, [currentSessionId, lectures]);

  const toggleLecture = useCallback((lectureId: number) => {
    setExpandedLectureIds((prev) => {
      const next = new Set(prev);
      if (next.has(lectureId)) {
        next.delete(lectureId);
      } else {
        next.add(lectureId);
      }
      return next;
    });
  }, []);

  const expandAllLectures = useCallback(() => {
    setExpandedLectureIds(new Set(expandableLectureIds));
  }, [expandableLectureIds]);

  const collapseToSelection = useCallback(() => {
    setExpandedLectureIds(selectedParentLectureId == null ? new Set() : new Set([selectedParentLectureId]));
  }, [selectedParentLectureId]);

  const expandedExpandableCount = expandableLectureIds.filter((id) => expandedLectureIds.has(id)).length;

  return (
    <TreeNav ariaLabel="강의 차시 트리">
      {lectures.length > 0 && (
        <TreeToolbar
          meta={`${lectures.length}개 강의 · ${totalSessionCount}개 차시`}
          actions={
            <>
              <TreeIconButton
                aria-label="전체 펼치기"
                title="전체 펼치기"
                onClick={expandAllLectures}
                disabled={expandedExpandableCount === expandableLectureIds.length}
              >
                <ChevronsUpDown size={15} aria-hidden />
              </TreeIconButton>
              <TreeIconButton
                aria-label={selectedParentLectureId == null ? "전체 접기" : "선택만 남기고 접기"}
                title={selectedParentLectureId == null ? "전체 접기" : "선택만 남기고 접기"}
                onClick={collapseToSelection}
                disabled={expandedExpandableCount === (selectedParentLectureId == null ? 0 : 1)}
              >
                <ChevronsDownUp size={15} aria-hidden />
              </TreeIconButton>
            </>
          }
        />
      )}
      {lectures.map((lec) => {
        const sessions = lec.sessions ?? [];
        const isExpanded = expandedLectureIds.has(lec.id);
        const hasSelectedSession = sessions.some((session) => session.id === currentSessionId);
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
              aria-label={`${lectureLabel} ${isExpanded ? "접기" : "펼치기"}`}
            />
            {sessions.length > 0 && isExpanded && (
              <TreeChildren>
                {sessions.map((s) => {
                  const isActive = currentSessionId === s.id;
                  return (
                    <TreeRow
                      key={s.id}
                      label={formatSessionTreeLabel(s)}
                      icon={<FileText size={15} />}
                      active={isActive}
                      selected={isActive}
                      onClick={() => onSelectSession(s.id)}
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
