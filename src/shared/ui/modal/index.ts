// PATH: src/shared/ui/modal/index.ts
// 모달 SSOT — 모든 모달 공통: AdminModal, 본문/푸터, 날짜·시간 섹션(달력·타임스크롤)

import "./modal.css";

export { default as AdminModal } from "./AdminModal";
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
