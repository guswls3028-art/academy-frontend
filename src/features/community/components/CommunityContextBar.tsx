// PATH: src/features/community/components/CommunityContextBar.tsx
// Scope-aware context bar — visual differentiation for all/lecture/session

import type { CommunityScope } from "../api/community.api";
import { Globe, BookOpen, Layers } from "lucide-react";

type CommunityContextBarProps = {
  scope: CommunityScope;
  lectureName?: string | null;
  sessionName?: string | null;
  extra?: React.ReactNode;
};

const SCOPE_CONFIG = {
  all: {
    icon: Globe,
    label: "전체",
    className: "community-context-bar--all",
  },
  lecture: {
    icon: BookOpen,
    label: "강의",
    className: "community-context-bar--lecture",
  },
  session: {
    icon: Layers,
    label: "차시",
    className: "community-context-bar--session",
  },
} as const;

export default function CommunityContextBar({
  scope,
  lectureName,
  sessionName,
  extra,
}: CommunityContextBarProps) {
  const config = SCOPE_CONFIG[scope] ?? SCOPE_CONFIG.all;
  const IconComp = config.icon;

  let detail: string | null = null;
  if (scope === "session" && lectureName && sessionName) {
    detail = `${lectureName} > ${sessionName}`;
  } else if (scope === "lecture" && lectureName) {
    detail = lectureName;
  }

  return (
    <div className={`community-context-bar ${config.className}`}>
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
