// PATH: src/app_admin/domains/community/hooks/useTreeCounts.ts
// 백엔드 counts 엔드포인트 → 트리 뷰 표시용 형태 변환
// 이전: 500~2000건 풀 페치 후 클라이언트 집계 → 단일 query 집계로 교체

import { useQuery } from "@tanstack/react-query";
import { fetchPostCounts, type PostType } from "../api/community.api";

export interface TreeCounts {
  totalCount: number;
  totalUnderScope: number;
  countByNodeId: Record<number, number>;
  countByLecture: Record<number, number>;
}

/**
 * GET /community/posts/counts/?post_type=... 결과를 CmsTreeNav가 기대하는 shape으로 변환.
 *
 * - totalCount: 전체 글 수
 * - totalUnderScope: 노드(강의/차시)에 매핑된 글 수 (GLOBAL 제외) = total - global_count
 */
export function useTreeCounts(postType: PostType): {
  counts: TreeCounts;
  isLoading: boolean;
  isError: boolean;
} {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["community", postType, "counts"],
    queryFn: () => fetchPostCounts(postType),
    staleTime: 30_000,
  });

  const counts: TreeCounts = {
    totalCount: data?.total ?? 0,
    totalUnderScope: (data?.total ?? 0) - (data?.global_count ?? 0),
    countByNodeId: data?.by_node_id ?? {},
    countByLecture: data?.by_lecture_id ?? {},
  };

  return { counts, isLoading, isError };
}
