// PATH: src/app_admin/domains/community/components/ScopeBadge.tsx
// 게시 대상(scope) 배지 — 전체 대상 / 강의명 / 차시명
import { Badge } from "@/shared/ui/ds";
import type { PostEntity } from "../api/community.api";
import { resolveScopeLabel, resolveScopeType, SCOPE_TONE } from "../utils/scopeBadge";

type Props = {
  post: PostEntity;
  className?: string;
};

export default function ScopeBadge({ post, className }: Props) {
  const label = resolveScopeLabel(post);
  const scopeType = resolveScopeType(post);
  return (
    <Badge tone={SCOPE_TONE[scopeType]} className={className}>
      {label}
    </Badge>
  );
}
