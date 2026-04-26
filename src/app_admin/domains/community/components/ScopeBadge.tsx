// PATH: src/app_admin/domains/community/components/ScopeBadge.tsx
// 게시 대상(scope) 배지 — 전체 대상 / 강의명 / 차시명
import { Badge, type BadgeTone } from "@/shared/ui/ds";
import type { PostEntity } from "../api/community.api";

type Props = {
  post: PostEntity;
  className?: string;
};

/** scope_type을 해석하여 대상 배지 라벨을 반환 */
export function resolveScopeLabel(post: PostEntity): string {
  if (!post.mappings || post.mappings.length === 0) return "전체 대상";
  const nd = post.mappings[0]?.node_detail;
  if (!nd) return "전체 대상";
  if (nd.session_title) return `${nd.lecture_title} > ${nd.session_title}`;
  if (nd.lecture_title) return nd.lecture_title;
  return "전체 대상";
}

/** scope_type 해석 */
export function resolveScopeType(post: PostEntity): "global" | "lecture" | "session" {
  if (!post.mappings || post.mappings.length === 0) return "global";
  const nd = post.mappings[0]?.node_detail;
  if (!nd) return "global";
  if (nd.session_title || nd.session) return "session";
  if (nd.lecture_title || nd.lecture) return "lecture";
  return "global";
}

const SCOPE_TONE: Record<"global" | "lecture" | "session", BadgeTone> = {
  global: "neutral",
  lecture: "primary",
  session: "complement",
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
