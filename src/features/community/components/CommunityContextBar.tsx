// PATH: src/features/community/components/CommunityContextBar.tsx
// Scope-aware context indicator — inline badge style (not a floating bar)

import type { CommunityScope } from "../api/community.api";
import { Globe, BookOpen, Layers } from "lucide-react";

type CommunityContextBarProps = {
  scope: CommunityScope;
  lectureName?: string | null;
  sessionName?: string | null;
  extra?: React.ReactNode;
  /** true = render as inline badge (inside header), false = render as full-width bar (legacy) */
  inline?: boolean;
};

const SCOPE_CONFIG = {
  all: {
    icon: Globe,
    label: "전체",
    className: "community-scope-chip--all",
  },
  lecture: {
    icon: BookOpen,
    label: "강의",
    className: "community-scope-chip--lecture",
  },
  session: {
    icon: Layers,
    label: "차시",
    className: "community-scope-chip--session",
  },
} as const;

export default function CommunityContextBar({
  scope,
  lectureName,
  sessionName,
  extra,
  inline,
}: CommunityContextBarProps) {
  const config = SCOPE_CONFIG[scope] ?? SCOPE_CONFIG.all;
  const IconComp = config.icon;

  let detail: string | null = null;
  if (scope === "session" && lectureName && sessionName) {
    detail = `${lectureName} > ${sessionName}`;
  } else if (scope === "session" && sessionName) {
    detail = sessionName;
  } else if (scope === "lecture" && lectureName) {
    detail = lectureName;
  }

  // Inline chip mode — sits inside header row
  if (inline) {
    return (
      <span className={`community-scope-chip ${config.className}`}>
        <IconComp size={12} aria-hidden className="community-scope-chip__icon" />
        <span className="community-scope-chip__label">
          {detail || config.label}
        </span>
        {extra}
      </span>
    );
  }

  // Full-width bar mode (for QnA/Counsel where it makes sense as a banner)
  return (
    <div className={`community-context-bar community-context-bar--${scope}`}>
      <IconComp className="community-context-bar__icon" />
      <span className="community-context-bar__scope-label">{config.label}</span>
      {detail && (
        <>
          <span className="community-context-bar__dot" aria-hidden="true" />
          <span className="community-context-bar__detail">{detail}</span>
        </>
      )}
      {extra && (
        <>
          <span className="community-context-bar__dot" aria-hidden="true" />
          <span className="community-context-bar__extra">{extra}</span>
        </>
      )}
    </div>
  );
}
