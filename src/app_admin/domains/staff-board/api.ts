import { useQuery } from "@tanstack/react-query";
import useAuth from "@/auth/hooks/useAuth";
import api from "@/shared/api/axios";
import type { components } from "@/shared/api/generated/schema";
import { getTenantCodeForApiRequest } from "@/shared/tenant";

export const boardRoot = "/workspace/staff-board";
export const boardLabels = { notice: "공지사항", resource: "자료실", free: "자유게시글" } as const;
export type Category = components["schemas"]["StaffBoardCategory"];
export const boardTabs = (Object.keys(boardLabels) as Category[]).map(key => ({
  key, label: boardLabels[key], path: `${boardRoot}/${key}`,
}));

export type PostRow = components["schemas"]["StaffBoardSummary"];
export type Reply = components["schemas"]["StaffBoardReply"];
export type Post = components["schemas"]["StaffBoardDetail"];
type PostPage = components["schemas"]["PaginatedStaffBoardSummaryList"];
const endpoint = "/staffs/board/posts/";

export function useBoardScope() {
  const { user } = useAuth();
  return ["staff-board", getTenantCodeForApiRequest(), user?.id] as const;
}
export type BoardScope = ReturnType<typeof useBoardScope>;

export function useBoardList(scope: BoardScope, category: Category, page = 1, pageSize = 20, refreshInterval?: number) {
  return useQuery({
    queryKey: [...scope, "list", category, page, pageSize],
    enabled: Boolean(scope[1] && scope[2]),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<PostPage>(endpoint, { params: { category, page, page_size: pageSize }, signal });
      if (!Array.isArray(data?.results) || !Number.isInteger(data.count)) throw new Error("게시글 목록을 확인할 수 없습니다.");
      return data;
    },
    staleTime: 30_000,
    refetchInterval: refreshInterval,
  });
}

export function useBoardPost(scope: BoardScope, id: number) {
  return useQuery({
    queryKey: [...scope, "detail", id],
    enabled: Boolean(scope[1] && scope[2]),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<Post>(`${endpoint}${id}/`, { signal });
      if (data?.id !== id || !Array.isArray(data.replies)) throw new Error("게시글을 확인할 수 없습니다.");
      return data;
    },
  });
}

export async function savePost(category: Category, title: string, body: string, file: File | null, id?: number) {
  if (id) return (await api.patch<PostRow>(`${endpoint}${id}/`, { title, body })).data;
  if (!file) return (await api.post<PostRow>(endpoint, { category, title, body })).data;
  const data = new FormData();
  data.set("category", category);
  data.set("title", title);
  data.set("body", body);
  data.set("file", file);
  return (await api.post<PostRow>(endpoint, data, { timeout: 120_000 })).data;
}

export async function addReply(id: number, body: string) {
  return (await api.post<Reply>(`${endpoint}${id}/replies/`, { body })).data;
}

export async function downloadAttachment(id: number) {
  const { data } = await api.get<components["schemas"]["StaffBoardDownload"]>(`${endpoint}${id}/download/`);
  const url = new URL(data.url);
  if (url.protocol !== "https:") throw new Error("다운로드 주소를 확인할 수 없습니다.");
  window.location.assign(url.href);
}

const dateFormat = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul", year: "numeric", month: "numeric", day: "numeric",
});
export function boardDate(value: string) {
  return dateFormat.format(new Date(value));
}
