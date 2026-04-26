// PATH: src/app_admin/domains/community/components/CommunityContextBar.tsx
// 커뮤니티 게시 대상(scope) 인디케이터 — 헤더 옆에 붙는 인라인 칩
// 강의/차시 필터링이 의미있는 게시판/공지/자료실에서만 사용.
// scope='all' 고정인 화면(QnA/상담)에는 추가하지 말 것 — 정보가치 0.

import type { CommunityScope } from "../api/community.api";
import { Globe, BookOpen, Layers } from "lucide-react";
import { ICON } from "@/shared/ui/ds";

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

  return (
    <span className={`community-scope-chip ${config.className}`}>
      <IconComp size={ICON.xs} aria-hidden className="community-scope-chip__icon" />
      <span className="community-scope-chip__label">
        {detail || config.label}
      </span>
      {extra}
    </span>
  );
}
