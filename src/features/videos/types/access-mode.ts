// PATH: src/features/videos/types/access-mode.ts

/**
 * Video Access Mode Type
 * 
 * Replaces ambiguous "once" logic with clear access model:
 * - FREE_REVIEW: Free review mode (no restrictions)
 * - PROCTORED_CLASS: Online replacement class (restrictions apply)
 * - BLOCKED: Access blocked
 */
export type AccessMode = "FREE_REVIEW" | "PROCTORED_CLASS" | "BLOCKED";

/**
 * Legacy rule type (backward compatibility)
 * @deprecated Use AccessMode instead
 */
export type VideoRule = "free" | "once" | "blocked";

/**
 * Map legacy rule to access mode
 */
export function mapRuleToAccessMode(rule: VideoRule): AccessMode {
  const mapping: Record<VideoRule, AccessMode> = {
    free: "FREE_REVIEW",
    once: "PROCTORED_CLASS",
    blocked: "BLOCKED",
  };
  return mapping[rule] || "FREE_REVIEW";
}

/**
 * Map access mode to legacy rule (for backward compatibility)
 */
export function mapAccessModeToRule(accessMode: AccessMode): VideoRule {
  const mapping: Record<AccessMode, VideoRule> = {
    FREE_REVIEW: "free",
    PROCTORED_CLASS: "once",
    BLOCKED: "blocked",
  };
  return mapping[accessMode] || "free";
}
