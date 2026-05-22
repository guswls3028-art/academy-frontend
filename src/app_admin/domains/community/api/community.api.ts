import api from "@/shared/api/axios";
import {
  bulkUpdateCommunityPostStatus,
  createCommunityAnswer,
  createCommunityPost,
  deleteCommunityPost,
  deleteCommunityPostAttachment,
  deleteCommunityReply,
  fetchCommunityAdminPosts,
  fetchCommunityBoardPosts,
  fetchCommunityMaterialsPosts,
  fetchCommunityNoticePosts,
  fetchCommunityPost,
  fetchCommunityPostCounts,
  fetchCommunityPostReplies,
  fetchCommunityPosts,
  fetchCommunityScopeNodes,
  getCommunityAttachmentDownloadUrl,
  isCommunityPostAnswered,
  postEntityToQuestion,
  resolveNodeIdFromScope,
  resolvePostNodeIdsForCreate,
  updateCommunityPost,
  updateCommunityPostNodes,
  updateCommunityReply,
  uploadCommunityPostAttachments,
  type BulkStatusValue,
  type CommunityPostCreatePayload,
  type CommunityScopeParams,
  type PostType,
  type PostUpdatePayload,
} from "@/shared/api/contracts/community";

export type {
  Answer,
  BulkStatusValue,
  CommunityScope,
  CommunityScopeParams,
  PostAttachment,
  PostAuthorContext,
  PostCountsResponse,
  PostEntity,
  PostMappingItem,
  PostStatus,
  PostType,
  PostUpdatePayload,
  Question,
  ResolvedPostScope,
  ScopeNodeMinimal,
} from "@/shared/api/contracts/community";

export {
  isCommunityPostAnswered,
  resolveNodeIdFromScope,
  resolvePostNodeIdsForCreate,
};

export function fetchScopeNodes() {
  return fetchCommunityScopeNodes(api);
}

export function fetchPosts(params: {
  nodeId?: number | null;
  pageSize?: number;
  postType?: PostType;
}) {
  return fetchCommunityPosts(api, params);
}

export function fetchPost(id: number) {
  return fetchCommunityPost(api, id);
}

export function fetchNoticePosts(params?: { page?: number; pageSize?: number }) {
  return fetchCommunityNoticePosts(api, params);
}

export function fetchBoardPostsByEndpoint(params?: { page?: number; pageSize?: number }) {
  return fetchCommunityBoardPosts(api, params);
}

export function fetchMaterialsPostsByEndpoint(params?: { page?: number; pageSize?: number }) {
  return fetchCommunityMaterialsPosts(api, params);
}

export function fetchAdminPosts(params: {
  postType?: PostType | null;
  lectureId?: number | null;
  q?: string | null;
  page?: number;
  pageSize?: number;
}) {
  return fetchCommunityAdminPosts(api, params);
}

export function createPost(data: CommunityPostCreatePayload) {
  return createCommunityPost(api, data);
}

export function updatePostNodes(postId: number, nodeIds: number[]) {
  return updateCommunityPostNodes(api, postId, nodeIds);
}

export function updatePost(postId: number, data: Partial<PostUpdatePayload>) {
  return updateCommunityPost(api, postId, data);
}

export async function fetchCommunityQuestions(
  params?: CommunityScopeParams | null,
) {
  const { results } = await fetchAdminPosts({
    postType: "qna",
    lectureId: params?.scope === "lecture" ? (params.lectureId ?? undefined) : undefined,
    pageSize: 500,
  });
  return results.map((post) => ({
    ...postEntityToQuestion(post),
    is_answered: isCommunityPostAnswered(post),
  }));
}

export function fetchPostReplies(postId: number) {
  return fetchCommunityPostReplies(api, postId, { fallbackToEmpty: true });
}

export async function fetchQuestionAnswer(questionId: number) {
  const replies = await fetchPostReplies(questionId);
  return replies.length > 0 ? replies[0] : null;
}

export function createAnswer(questionId: number, content: string) {
  return createCommunityAnswer(api, questionId, content);
}

export function deletePost(postId: number) {
  return deleteCommunityPost(api, postId);
}

export function bulkUpdatePostStatus(ids: number[], newStatus: BulkStatusValue) {
  return bulkUpdateCommunityPostStatus(api, ids, newStatus);
}

export function updateReply(postId: number, replyId: number, content: string) {
  return updateCommunityReply(api, postId, replyId, content);
}

export function deleteReply(postId: number, replyId: number) {
  return deleteCommunityReply(api, postId, replyId);
}

export function uploadPostAttachments(postId: number, files: File[]) {
  return uploadCommunityPostAttachments(api, postId, files);
}

export function getAttachmentDownloadUrl(postId: number, attId: number) {
  return getCommunityAttachmentDownloadUrl(api, postId, attId);
}

export function deletePostAttachment(postId: number, attId: number) {
  return deleteCommunityPostAttachment(api, postId, attId);
}

export async function fetchPostAuthorContext(studentId: number) {
  const { getStudentDetail } = await import("@admin/domains/students/api/students.api");
  const student = await getStudentDetail(studentId);
  return {
    id: student.id,
    name: student.name,
    displayName: student.displayName,
    school: student.school,
    schoolClass: student.schoolClass,
    grade: student.grade,
    studentPhone: student.studentPhone,
    parentPhone: student.parentPhone,
    enrollments: student.enrollments.map((enrollment) => ({
      id: enrollment.id,
      lectureId: enrollment.lectureId,
      lectureName: enrollment.lectureName,
      lectureColor: enrollment.lectureColor,
      lectureChipLabel: enrollment.lectureChipLabel,
    })),
  };
}

export function fetchPostCounts(postType: PostType) {
  return fetchCommunityPostCounts(api, postType);
}
