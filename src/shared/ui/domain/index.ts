// src/shared/ui/domain/index.ts
// 도메인 공통 UI (Design SSOT — students 기준)

export { default as DomainLayout } from "./DomainLayout";
export { default as DomainTabs } from "./DomainTabs";
export { default as DomainPanel } from "./DomainPanel";
export { default as DomainTable } from "./DomainTable";
export { default as DomainListToolbar } from "./DomainListToolbar";
export type { DomainTab } from "./DomainTabs";
export type { DomainCrumb } from "./DomainLayout";
export {
  STATUS_ACTIVE_COLOR,
  STATUS_INACTIVE_COLOR,
  PRESET_COLORS,
  DEFAULT_PRESET_COLOR,
  getDefaultColorForPicker,
} from "./constants";
export { default as ColorPickerField } from "./ColorPickerField";
