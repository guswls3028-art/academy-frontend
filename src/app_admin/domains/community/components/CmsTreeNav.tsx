// PATH: src/app_admin/domains/community/components/CmsTreeNav.tsx
// Reusable tree navigation for community CMS pages (notices, board, materials)

import { useState, useCallback, useMemo } from "react";
import { ClipboardList, Folder, FolderOpen } from "lucide-react";
import LectureChip from "@/shared/ui/chips/LectureChip";
import { ICON } from "@/shared/ui/ds";
import {
  TreeBranch,
  TreeChildren,
  TreeNav,
  TreeRow,
  TreeStaticRow,
} from "@/shared/ui/domain";
import { formatSessionBlockLabel } from "@/shared/ui/session-block";
import { isSupplementSession, sortSessionsByDisplayOrder } from "@/shared/product/sessions/sessionOrdering";

interface CmsTreeNavProps {
  title: string;
  allLabel: string;
  counts: {
    totalCount: number;
    totalUnderScope: number;
    countByNodeId: Record<number, number>;
    countByLecture: Record<number, number>;
  };
  scope: string;
  lectureId: number | null;
  sessionId: number | null;
  effectiveLectureId: number | null;
  lectures: Array<{ id: number; title?: string; name?: string; color?: string | null; chip_label?: string | null }>;
  scopeNodes: Array<{ id: number; lecture: number; session: number | null; session_title?: string | null }>;
  sessionsOfLecture: Array<{
    id: number;
    title: string;
    order: number;
    regular_order?: number | null;
    session_type?: string | null;
  }>;
  sessionsLoading: boolean;
  expandedLectureId: number | null;
  onExpandLecture: (lecId: number | null) => void;
  onSelectAll: () => void;
  onSelectLecture: (lecId: number) => void;
  onSelectSession: (lecId: number, sesId: number) => void;
}

export default function CmsTreeNav({
  title,
  allLabel,
  counts,
  scope,
  lectureId,
  sessionId,
  lectures,
  scopeNodes,
  sessionsOfLecture,
  sessionsLoading,
  expandedLectureId,
  onExpandLecture,
  onSelectAll,
  onSelectLecture,
  onSelectSession,
}: CmsTreeNavProps) {
  const [expandedParent, setExpandedParent] = useState(false);

  const toggleParent = useCallback(() => {
    setExpandedParent((p) => {
      if (!p) return true;
      onExpandLecture(null);
      return false;
    });
  }, [onExpandLecture]);

  const toggleLecture = useCallback(
    (lecId: number) => {
      onExpandLecture(expandedLectureId === lecId ? null : lecId);
    },
    [expandedLectureId, onExpandLecture]
  );

  const sortedSessionsOfLecture = useMemo(
    () => sortSessionsByDisplayOrder(sessionsOfLecture),
    [sessionsOfLecture]
  );

  return (
    <nav className="notice-tree__nav">
      <div className="notice-tree__nav-header">
        <h2 className="notice-tree__nav-title">{title}</h2>
      </div>

      <TreeNav className="notice-tree__tree" ariaLabel={title}>
        <TreeRow
          label={allLabel}
          icon={<ClipboardList size={ICON.sm} />}
          count={counts.totalCount > 0 ? counts.totalCount : undefined}
          active={scope === "all"}
          selected={scope === "all"}
          onClick={onSelectAll}
          aria-selected={scope === "all"}
        />
        <TreeRow
          label="강의목록"
          icon={expandedParent ? <FolderOpen size={ICON.sm} /> : <Folder size={ICON.sm} />}
          count={counts.totalUnderScope > 0 ? counts.totalUnderScope : undefined}
          expandable
          expanded={expandedParent}
          active={expandedParent}
          onClick={toggleParent}
          aria-expanded={expandedParent}
        />

        {expandedParent && (
          <TreeChildren>
            {lectures.map((lec) => {
              const isExpanded = expandedLectureId === lec.id;
              const isSelected = scope === "lecture" && lectureId === lec.id;
              return (
                <TreeBranch key={`lec-${lec.id}`}>
                  <TreeRow
                    label={lec.title || lec.name || `강의 ${lec.id}`}
                    icon={
                      <LectureChip
                        lectureName={lec.title || lec.name || ""}
                        color={lec.color ?? undefined}
                        size={20}
                        chipLabel={lec.chip_label}
                      />
                    }
                    count={
                      (counts.countByLecture[lec.id] ?? 0) > 0
                        ? counts.countByLecture[lec.id]
                        : undefined
                    }
                    expandable
                    expanded={isExpanded}
                    active={isExpanded || isSelected}
                    selected={isSelected}
                    onClick={() => {
                      toggleLecture(lec.id);
                      onSelectLecture(lec.id);
                    }}
                    aria-expanded={isExpanded}
                    aria-selected={isSelected}
                  />
                  {isExpanded && (
                    <TreeChildren>
                      {sessionsLoading ? (
                        <TreeStaticRow
                          label="불러오는 중..."
                          density="compact"
                          tone="muted"
                        />
                      ) : (
                        sortedSessionsOfLecture.map((s) => {
                          const sessionNodeId = scopeNodes.find(
                            (n) => n.lecture === lec.id && n.session === s.id
                          )?.id;
                          const sessionCount =
                            sessionNodeId != null
                              ? (counts.countByNodeId[sessionNodeId] ?? 0)
                              : 0;
                          const supplement = isSupplementSession(s);
                          const isSessionSelected =
                            scope === "session" &&
                            lectureId === lec.id &&
                            sessionId === s.id;
                          return (
                            <TreeRow
                              key={s.id}
                              label={formatSessionBlockLabel(s)}
                              icon={<span aria-hidden>·</span>}
                              count={sessionCount > 0 ? sessionCount : undefined}
                              density="compact"
                              tone={supplement ? "accent" : "primary"}
                              active={isSessionSelected}
                              selected={isSessionSelected}
                              onClick={() => onSelectSession(lec.id, s.id)}
                              aria-selected={isSessionSelected}
                            />
                          );
                        })
                      )}
                    </TreeChildren>
                  )}
                </TreeBranch>
              );
            })}
          </TreeChildren>
        )}
      </TreeNav>
    </nav>
  );
}
