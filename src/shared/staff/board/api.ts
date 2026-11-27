import { useQuery } from "@tanstack/react-query";
import useAuth from "@/auth/hooks/useAuth";
import api from "@/shared/api/axios";
import type { components, operations } from "@/shared/api/generated/schema";
import { getTenantCodeForApiRequest } from "@/shared/tenant";
import { downloadBlob } from "@/shared/utils/safeDownload";

export const boardLabels = { notice: "공지사항", resource: "자료실", free: "자유게시글" } as const;
export type Category = components["schemas"]["StaffBoardCategory"];
export const boardListLabels = { all: "전체 글", ...boardLabels };
export type BoardFilter = keyof typeof boardListLabels;
export const boardWriteLabels = { notice: "공지 작성", resource: "자료 올리기", free: "글쓰기" } as const;

export type PostRow = components["schemas"]["StaffBoardSummary"];
export type Reply = components["schemas"]["StaffBoardReply"];
export type Post = components["schemas"]["StaffBoardDetail"];
type PostPage = components["schemas"]["PaginatedStaffBoardSummaryList"];
type BoardListParams = operations["staffs_board_posts_list"]["parameters"]["query"];
const endpoint = "/staffs/board/posts/";

export function useBoardScope() {
  const { user } = useAuth();
  return ["staff-board", getTenantCodeForApiRequest(), user?.id] as const;
}
export type BoardScope = ReturnType<typeof useBoardScope>;

export const boardKeys = {
  lists: (scope: BoardScope) => [...scope, "list"] as const,
  list: (scope: BoardScope, category: BoardFilter, page: number, pageSize: number, q: string) =>
    [...boardKeys.lists(scope), category, page, pageSize, q] as const,
  detail: (scope: BoardScope, id: number) => [...scope, "detail", id] as const,
};

export function useBoardList(scope: BoardScope, category: BoardFilter, {
  page = 1, pageSize = 20, refreshInterval, q = "",
}: { page?: number; pageSize?: number; refreshInterval?: number; q?: string } = {}) {
  return useQuery({
    queryKey: boardKeys.list(scope, category, page, pageSize, q),
    enabled: Boolean(scope[1] && scope[2]),
    queryFn: async ({ signal }) => {
      const params: BoardListParams = { category: category === "all" ? undefined : category, page, page_size: pageSize, q: q || undefined };
      const { data } = await api.get<PostPage>(endpoint, { params, signal });
      if (!Array.isArray(data?.results) || !Number.isInteger(data.count) || !data.results.every(row =>
        row && Object.prototype.hasOwnProperty.call(boardLabels, row.category) && (category === "all" || row.category === category)
        && Number.isSafeInteger(row.id) && typeof row.title === "string"
        && typeof row.created_at === "string" && Number.isFinite(Date.parse(row.created_at))
      )) throw new Error("게시글 목록을 확인할 수 없습니다.");
      return data;
    },
    staleTime: 30_000,
    refetchInterval: refreshInterval,
  });
}

export function useBoardPost(scope: BoardScope, id: number) {
  return useQuery({
    queryKey: boardKeys.detail(scope, id),
    enabled: Boolean(scope[1] && scope[2]),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<Post>(`${endpoint}${id}/`, { signal });
      if (data?.id !== id || !Array.isArray(data.replies)) throw new Error("게시글을 확인할 수 없습니다.");
      return data;
    },
  });
}

type PostDraft = { title: string; body: string; file: File | null };

export async function savePost(category: Category, draft: PostDraft, key: string, id?: number) {
  const { title, body, file } = draft;
  if (id) return (await api.patch<PostRow>(`${endpoint}${id}/`, { title, body })).data;
  const headers = { "Idempotency-Key": key };
  if (!file) return (await api.post<PostRow>(endpoint, { category, title, body }, { headers })).data;
  const data = new FormData();
  data.set("category", category);
  data.set("title", title);
  data.set("body", body);
  data.set("file", file);
  return (await api.post<PostRow>(endpoint, data, { headers, timeout: 120_000 })).data;
}

export async function addReply(id: number, body: string, key: string) {
  return (await api.post<Reply>(`${endpoint}${id}/replies/`, { body }, {
    headers: { "Idempotency-Key": key },
  })).data;
}

export async function deletePost(id: number) {
  await api.delete(`${endpoint}${id}/`);
}

export async function editReply(id: number, replyId: number, body: string) {
  return (await api.patch<Reply>(`${endpoint}${id}/replies/${replyId}/`, { body })).data;
}

export async function deleteReply(id: number, replyId: number) {
  await api.delete(`${endpoint}${id}/replies/${replyId}/`);
}

export async function downloadAttachment(id: number, filename: string) {
  const { data } = await api.get<Blob>(`${endpoint}${id}/attachment/`, { responseType: "blob" });
  if (data.type !== "application/octet-stream" || data.size === 0) {
    throw new Error("첨부파일 응답을 확인할 수 없습니다.");
  }
  downloadBlob(data, filename);
}

export async function removeAttachment(id: number) {
  await api.delete(`${endpoint}${id}/attachment/`);
}

const dateFormat = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul", year: "numeric", month: "numeric", day: "numeric",
});
export function boardDate(value: string) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? dateFormat.format(time) : "작성일 확인 불가";
}
