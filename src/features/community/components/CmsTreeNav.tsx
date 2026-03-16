// PATH: src/features/community/components/CmsTreeNav.tsx
// Reusable tree navigation for community CMS pages (notices, board, materials)

import { useState, useCallback } from "react";
import { ChevronRight, ClipboardList, Folder, FolderOpen } from "lucide-react";
import LectureChip from "@/shared/ui/chips/LectureChip";
import { isSupplement } from "@/shared/ui/session-block/session-block.constants";

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
  lectures: Array<{ id: number; title?: string; name?: string; color?: string | null }>;
  scopeNodes: Array<{ id: number; lecture: number; session: number | null; session_title?: string | null }>;
  sessionsOfLecture: Array<{ id: number; title: string; order: number }>;
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

  return (
    <nav className="notice-tree__nav">
      <div className="notice-tree__nav-header">
        <h2 className="notice-tree__nav-title">{title}</h2>
      </div>

      <div className="notice-tree__tabs">
        <button
          type="button"
          className={`notice-tree__tab ${scope === "all" ? "notice-tree__tab--active notice-tree__tab--selected" : ""}`}
          onClick={onSelectAll}
          aria-selected={scope === "all"}
        >
          <ClipboardList size={16} className="cms-tree__icon" aria-hidden />
          <span className="notice-tree__tab-label">{allLabel}</span>
          {counts.totalCount > 0 && (
            <span className="notice-tree__count" aria-label={`${counts.totalCount}건`}>
              {counts.totalCount}
            </span>
          )}
          <span className="notice-tree__tab-chevron" aria-hidden />
        </button>
        <button
          type="button"
          className={`notice-tree__tab ${expandedParent ? "notice-tree__tab--active" : ""}`}
          onClick={toggleParent}
          aria-expanded={expandedParent}
        >
          {expandedParent ? (
            <FolderOpen size={16} className="cms-tree__icon" aria-hidden />
          ) : (
            <Folder size={16} className="cms-tree__icon" aria-hidden />
          )}
          <span className="notice-tree__tab-label">강의목록</span>
          {counts.totalUnderScope > 0 && (
            <span className="notice-tree__count" aria-label={`${counts.totalUnderScope}건`}>
              {counts.totalUnderScope}
            </span>
          )}
          <ChevronRight
            size={14}
            className={`cms-tree__chevron ${expandedParent ? "cms-tree__chevron--open" : ""}`}
            aria-hidden
          />
        </button>
      </div>

      <div className="notice-tree__sub">
        {expandedParent &&
          lectures.map((lec) => {
            const isExpanded = expandedLectureId === lec.id;
            const isSelected = scope === "lecture" && lectureId === lec.id;
            return (
              <div key={`lec-${lec.id}`} className="notice-tree__branch">
                <button
                  type="button"
                  className={`notice-tree__sub-item notice-tree__sub-item--parent ${isExpanded ? "notice-tree__sub-item--active" : ""} ${isSelected ? "notice-tree__sub-item--selected" : ""}`}
                  onClick={() => {
                    toggleLecture(lec.id);
                    onSelectLecture(lec.id);
                  }}
                  aria-expanded={isExpanded}
                  aria-selected={isSelected}
                >
                  <ChevronRight
                    size={14}
                    className={`cms-tree__chevron ${isExpanded ? "cms-tree__chevron--open" : ""}`}
                    aria-hidden
                  />
                  <LectureChip
                    lectureName={lec.title || lec.name || ""}
                    color={lec.color ?? undefined}
                    size={20}
                  />
                  <span className="notice-tree__sub-label">
                    {lec.title || lec.name || `강의 ${lec.id}`}
                  </span>
                  {(counts.countByLecture[lec.id] ?? 0) > 0 && (
                    <span
                      className="notice-tree__count"
                      aria-label={`${counts.countByLecture[lec.id]}건`}
                    >
                      {counts.countByLecture[lec.id]}
                    </span>
                  )}
                  <span className="notice-tree__sub-chevron-right" aria-hidden />
                </button>
                {isExpanded && (
                  <div className="notice-tree__children">
                    {sessionsLoading ? (
                      <div
                        className="notice-tree__sub-item notice-tree__sub-item--child"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        불러오는 중…
                      </div>
                    ) : (
                      sessionsOfLecture.map((s) => {
                        const sessionNodeId = scopeNodes.find(
                          (n) => n.lecture === lec.id && n.session === s.id
                        )?.id;
                        const sessionCount =
                          sessionNodeId != null
                            ? (counts.countByNodeId[sessionNodeId] ?? 0)
                            : 0;
                        const supplement = isSupplement(s.title);
                        const isSessionSelected =
                          scope === "session" &&
                          lectureId === lec.id &&
                          sessionId === s.id;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            className={`notice-tree__sub-item notice-tree__sub-item--child ${supplement ? "notice-tree__sub-item--supplement" : "notice-tree__sub-item--n1"} ${isSessionSelected ? "notice-tree__sub-item--active notice-tree__sub-item--selected" : ""}`}
                            onClick={() => onSelectSession(lec.id, s.id)}
                            aria-selected={isSessionSelected}
                          >
                            <span className="notice-tree__sub-item-child-icon" aria-hidden>
                              ·
                            </span>
                            <span className="notice-tree__sub-label">
                              {s.title || `${s.order}차시`}
                            </span>
                            {sessionCount > 0 && (
                              <span
                                className="notice-tree__count"
                                aria-label={`${sessionCount}건`}
                              >
                                {sessionCount}
                              </span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </nav>
  );
}
