export const EXPECTED_UPDATED_AT_HEADER = "X-Expected-Updated-At";

export function expectedUpdatedAtHeaders(updatedAt?: string) {
  return updatedAt
    ? { [EXPECTED_UPDATED_AT_HEADER]: updatedAt }
    : undefined;
}

export function isStaleResourceConflict(error: unknown): boolean {
  const response = (error as {
    response?: { status?: number; data?: { code?: unknown } };
  })?.response;
  return response?.status === 409 && response.data?.code === "stale_resource";
}
