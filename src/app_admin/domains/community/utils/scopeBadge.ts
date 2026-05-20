import type { BadgeTone } from "@/shared/ui/ds";
import type { PostEntity } from "../api/community.api";

export type ScopeBadgeType = "global" | "lecture" | "session";

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
export function resolveScopeType(post: PostEntity): ScopeBadgeType {
  if (!post.mappings || post.mappings.length === 0) return "global";
  const nd = post.mappings[0]?.node_detail;
  if (!nd) return "global";
  if (nd.session_title || nd.session) return "session";
  if (nd.lecture_title || nd.lecture) return "lecture";
  return "global";
}

export const SCOPE_TONE: Record<ScopeBadgeType, BadgeTone> = {
  global: "neutral",
  lecture: "primary",
  session: "complement",
};
