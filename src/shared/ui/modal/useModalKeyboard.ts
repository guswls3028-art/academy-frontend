// PATH: src/shared/ui/modal/useModalKeyboard.ts
// 전역 모달 키보드 단축키 — 스택 기반으로 최상위 모달만 반응
//   Esc:   닫기/취소 (부정)
//   Enter: 등록/저장/확인 (긍정) — textarea·contenteditable·antd 드롭다운에서는 무시
//
// onConfirm 미전달 시: ModalFooter 우측의 마지막 활성 버튼을 자동 클릭 (auto-detect)

import { useEffect, useRef } from "react";

// ── 글로벌 스택: 최상위 모달만 키보드 이벤트를 처리 ──

type ModalEntry = {
  onClose: () => void;
  onConfirm: (() => void) | undefined;
};

const stack: ModalEntry[] = [];

/** Enter 무시해야 하는 포커스 상태인지 판별 */
function shouldSkipEnter(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;

  // textarea, contenteditable → Enter = 줄바꿈
  if (el.tagName === "TEXTAREA") return true;
  if (el.getAttribute?.("contenteditable") === "true") return true;

  // antd Select/Picker/Dropdown 열린 상태 → Enter = 항목 선택
  if (
    document.querySelector(
      ".ant-select-dropdown:not(.ant-select-dropdown-hidden)," +
      ".ant-picker-dropdown:not(.ant-picker-dropdown-hidden)," +
      ".ant-dropdown:not(.ant-dropdown-hidden)," +
      ".ant-cascader-dropdown:not(.ant-cascader-dropdown-hidden)"
    )
  ) {
    return true;
  }

  return false;
}

/** ModalFooter 우측의 마지막 활성 버튼 자동 클릭 */
function autoClickPrimary(): boolean {
  // 최상위 모달의 footer — DOM 상 마지막 .modal-footer
  const footers = document.querySelectorAll(".admin-modal__inner .modal-footer");
  if (footers.length === 0) return false;

  const footer = footers[footers.length - 1];
  const rightDiv = footer.lastElementChild;
  if (!rightDiv) return false;

  const buttons = rightDiv.querySelectorAll("button:not([disabled])");
  if (buttons.length === 0) return false;

  (buttons[buttons.length - 1] as HTMLButtonElement).click();
  return true;
}

function globalKeyHandler(e: KeyboardEvent) {
  if (stack.length === 0) return;
  const top = stack[stack.length - 1];

  if (e.key === "Escape") {
    e.preventDefault();
    e.stopImmediatePropagation();
    top.onClose();
    return;
  }

  if (e.key === "Enter") {
    if (shouldSkipEnter()) return;

    if (top.onConfirm) {
      e.preventDefault();
      e.stopImmediatePropagation();
      top.onConfirm();
      return;
    }

    // auto-detect: ModalFooter 우측 마지막 버튼 클릭
    if (autoClickPrimary()) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }
}

// ── Hook ──

export function useModalKeyboard(
  open: boolean,
  onClose: () => void,
  onConfirm?: () => void,
) {
  // 최신 콜백을 ref 로 유지 → useEffect deps 에 콜백 넣지 않아 불필요 재등록 방지
  const ref = useRef<ModalEntry>({ onClose, onConfirm });
  ref.current = { onClose, onConfirm };

  useEffect(() => {
    if (!open) return;

    // 스택에 stable proxy entry 추가 (ref.current 를 호출)
    const entry: ModalEntry = {
      get onClose() { return ref.current.onClose; },
      get onConfirm() { return ref.current.onConfirm; },
    };

    stack.push(entry);

    // 첫 모달이면 글로벌 핸들러 등록
    if (stack.length === 1) {
      document.addEventListener("keydown", globalKeyHandler, true); // capture phase
    }

    return () => {
      const idx = stack.indexOf(entry);
      if (idx >= 0) stack.splice(idx, 1);
      if (stack.length === 0) {
        document.removeEventListener("keydown", globalKeyHandler, true);
      }
    };
  }, [open]); // onClose/onConfirm 는 ref 로 추적하므로 deps 불필요
}
