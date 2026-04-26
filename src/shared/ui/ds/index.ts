// PATH: src/shared/ui/ds/index.ts

/* ===============================
 * DS GLOBAL STYLES — design-system에서 단일 로드 (src/styles/design-system/)
 * =============================== */
import "@/styles/design-system/ds/input.css";
import "@/styles/design-system/ds/action-bar.css";
import "@/styles/design-system/ds/panel.css";
import "@/styles/design-system/ds/card-modal-style.css";
import "@/styles/design-system/ds/page.css";
import "@/styles/design-system/ds/page-header.css";
import "@/styles/design-system/ds/list-page.css";

/* ===============================
 * DS COMPONENT EXPORTS
 * =============================== */
export { default as Page } from "./Page";
export { default as PageHeader } from "./PageHeader";
export { default as SectionHeader } from "./SectionHeader";
export { default as Section } from "./Section";
export { default as Panel } from "./Panel";
export { default as EmptyState } from "./EmptyState";
export { default as KPI } from "./KPI";
export { default as Button } from "./Button";
export * from "./Tabs";

export { default as ActionBar } from "./components/ActionBar";
export { default as ActionButton } from "./components/ActionButton";
export { default as StatusBadge } from "./components/StatusBadge";
export { default as StatusToggle } from "./components/StatusToggle";
export { default as CloseButton } from "./CloseButton";

/* Badge SSOT — 모든 신규 뱃지는 이 컴포넌트만 사용 */
export { default as Badge } from "./components/Badge";
export type { BadgeTone, BadgeSize, BadgeVariant } from "./components/Badge";

/* Icon size SSOT — lucide/antd icon에 size 직접 박지 말고 ICON.* 사용 */
export { ICON, ICON_FOR_BADGE, ICON_FOR_BUTTON } from "./iconSize";
export type { IconSizeKey } from "./iconSize";
