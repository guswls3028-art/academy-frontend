// PATH: src/app_admin/domains/community/hooks/useScopeFilteredPosts.ts
// 3개 어드민 트리 페이지(공지/게시판/자료실) 공통 — scope 기반 클라이언트 필터링
// 강의/차시 scope에서 전체글(GLOBAL)을 제외하고 상하위 노드 상속을 적용

import { useMemo } from "react";
import type { PostEntity, ScopeNodeMinimal, CommunityScope } from "../api/community.api";

export type ScopeKey = CommunityScope;

interface Args {
  posts: PostEntity[];
  scopeNodes: ScopeNodeMinimal[];
  scope: ScopeKey;
  nodeId: number | null;
}

/**
 * scope 기반 필터:
 *   - all  → 모든 글
 *   - lecture/session + nodeId → 해당 노드 + 상하위 노드 매핑 글 (GLOBAL 제외)
 */
export function useScopeFilteredPosts({ posts, scopeNodes, scope, nodeId }: Args): PostEntity[] {
  const visibleNodeIds = useMemo(() => {
    if (scope === "all" || nodeId == null) return null;
    const ids = new Set<number>();
    ids.add(nodeId);
    const selected = scopeNodes.find((n) => n.id === nodeId);
    if (selected) {
      if (selected.level === "COURSE") {
        for (const n of scopeNodes) {
          if (n.lecture === selected.lecture && n.level === "SESSION") ids.add(n.id);
        }
      } else if (selected.level === "SESSION") {
        for (const n of scopeNodes) {
          if (n.lecture === selected.lecture && n.level === "COURSE") ids.add(n.id);
        }
      }
    }
    return ids;
  }, [scope, nodeId, scopeNodes]);

  return useMemo(() => {
    if (scope === "all" || !visibleNodeIds) return posts;
    return posts.filter((p) => {
      if (!p.mappings || p.mappings.length === 0) return false;
      return p.mappings.some((m) => visibleNodeIds.has(m.node));
    });
  }, [posts, scope, visibleNodeIds]);
}
