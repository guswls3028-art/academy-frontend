export const EXPECTED_UPDATED_AT_HEADER = "X-Expected-Updated-At";

export function expectedUpdatedAtHeaders(updatedAt: string) {
  if (!updatedAt) {
    throw new Error("최신 수정 시각을 확인한 뒤 다시 저장해 주세요.");
  }
  return { [EXPECTED_UPDATED_AT_HEADER]: updatedAt };
}

export function isStaleResourceConflict(error: unknown): boolean {
  const response = (error as {
    response?: { status?: number; data?: { code?: unknown } };
  })?.response;
  return response?.status === 409 && response.data?.code === "stale_resource";
}
