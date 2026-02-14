// PATH: src/shared/ui/modal/index.ts
// =============================================================================
// 모달 SSOT (Single Source of Truth) — Admin 앱 전체 모달
// =============================================================================
// - 모든 Admin 모달은 반드시 여기서만 import (AdminModal, ModalHeader, ModalBody, ModalFooter)
// - 스타일: modal.css (태두리·헤더·배경·푸터·옵션행). 기존 DS antd/modal.css는 .admin-modal 제외
// - 폼 모달 내 날짜/시간: ModalDateSection, ModalTimeSection (전역 DatePicker·TimeRangeInput 사용)
// =============================================================================

import "./modal.css";

export { default as AdminModal } from "./AdminModal";
export type { AdminModalType } from "./AdminModal";
export { default as ModalHeader } from "./ModalHeader";
export { default as ModalBody } from "./ModalBody";
export { default as ModalFooter } from "./ModalFooter";
export { default as ModalOptionRow } from "./ModalOptionRow";
export { ModalOptionRowWithContent } from "./ModalOptionRow";
export type { ModalOptionRowProps, ModalOptionRowWithContentProps } from "./ModalOptionRow";
export { default as ModalDateSection } from "./ModalDateSection";
export type { ModalDateSectionProps } from "./ModalDateSection";
export { default as ModalTimeSection } from "./ModalTimeSection";
export type { ModalTimeSectionProps } from "./ModalTimeSection";
export { MODAL_DEFAULT_WIDTH, MODAL_WIDTH } from "./constants";
