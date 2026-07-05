// PATH: src/app_admin/domains/developer/queryKeys.ts

type DeveloperPostKind = "bug_report" | "dev_feedback";

export const adminDeveloperQueryKeys = {
  tenantFeatureFlags: ["tenants-feature-flags"] as const,
  posts: (kind: DeveloperPostKind) => ["dev-posts", kind] as const,
};
