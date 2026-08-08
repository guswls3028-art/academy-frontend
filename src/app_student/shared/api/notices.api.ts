import studentApi from "./student.api";
import {
  fetchCommunityNoticePosts,
  sortCommunityPostsPinnedFirst,
  type PostEntity,
} from "@/shared/api/contracts/community";

export async function fetchStudentNotices(pageSize = 200): Promise<PostEntity[]> {
  const posts = await fetchCommunityNoticePosts(studentApi, { pageSize });
  return sortCommunityPostsPinnedFirst(posts);
}
