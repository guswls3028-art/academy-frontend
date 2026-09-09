import { readActiveAuthGenerationSafely } from "@/shared/auth/tokenSession";
import {
  getTenantUserLocalKey,
  getTenantUserLocalItem,
  setTenantUserLocalItem,
} from "@/shared/utils/safeLocalStorage";

const PASSWORD_RECOMMENDATION_DISMISSAL_KEY =
  "academy:password-recommendation-dismissal:v1";

function authOwnerForGeneration(
  userId: string | number | null | undefined,
  authGeneration: string | null,
): string | null {
  const tenantUserKey = getTenantUserLocalKey(
    PASSWORD_RECOMMENDATION_DISMISSAL_KEY,
    userId,
  );
  return authGeneration && tenantUserKey
    ? `${tenantUserKey}:auth:${encodeURIComponent(authGeneration)}`
    : null;
}

export function readPasswordRecommendationAuthSession(
  userId: string | number | null | undefined,
): { owner: string | null; dismissed: boolean } {
  const authGeneration = readActiveAuthGenerationSafely();
  const owner = authOwnerForGeneration(userId, authGeneration);
  return {
    owner,
    dismissed: Boolean(
      owner
      && getTenantUserLocalItem(PASSWORD_RECOMMENDATION_DISMISSAL_KEY, userId)
        === authGeneration,
    ),
  };
}

export function dismissPasswordRecommendationForAuthSession(
  userId: string | number | null | undefined,
  expectedOwner: string | null,
):
  | { status: "dismissed"; owner: string }
  | { status: "storage-unavailable" }
  | { status: "owner-changed" } {
  const authGeneration = readActiveAuthGenerationSafely();
  const owner = authOwnerForGeneration(userId, authGeneration);
  if (!authGeneration || !owner) return { status: "storage-unavailable" };
  if (owner !== expectedOwner) return { status: "owner-changed" };
  setTenantUserLocalItem(
    PASSWORD_RECOMMENDATION_DISMISSAL_KEY,
    userId,
    authGeneration,
  );
  return { status: "dismissed", owner };
}
