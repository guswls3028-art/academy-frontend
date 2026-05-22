import api from "@/shared/api/axios";
import {
  createCommunityPost,
  uploadCommunityPostAttachments,
  type CommunityPostCreatePayload,
} from "@/shared/api/contracts/community";

export function createDeveloperCommunityPost(data: CommunityPostCreatePayload) {
  return createCommunityPost(api, data);
}

export function uploadDeveloperPostAttachments(postId: number, files: File[]) {
  return uploadCommunityPostAttachments(api, postId, files);
}
