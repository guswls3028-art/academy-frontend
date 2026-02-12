// src/shared/ui/layout/index.ts

/**
 * ======================================================
 * Layout Exports (SSOT)
 *
 * ❗ Layout 은 레이아웃만 export 한다
 * ❗ Design System(ds)은 절대 여기서 export 하지 않는다
 *
 * - Sidebar
 * - Header
 * - AppLayout
 * ======================================================
 */

export { default as AppLayout } from "./AppLayout";
export { default as Sidebar } from "./Sidebar";
export { default as Header } from "./Header";
export { default as DomainLayout } from "./DomainLayout";
export type { DomainTab } from "./DomainLayout";
