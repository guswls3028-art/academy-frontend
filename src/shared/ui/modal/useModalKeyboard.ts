// PATH: src/shared/ui/modal/useModalKeyboard.ts
// 전역 모달 키보드 단축키 — 스택 기반으로 최상위 모달만 반응
//   Esc:   닫기/취소 (부정)
//   Enter: 등록/저장/확인 (긍정) — textarea·contenteditable·antd 드롭다운에서는 무시
//
// onConfirm 미전달 시: 해당 모달의 명시적 primary 버튼만 실행한다.

import { useEffect, useRef, type RefObject } from "react";

// ── 글로벌 스택: 최상위 모달만 키보드 이벤트를 처리 ──

type ModalEntry = {
  onClose: () => void;
  onConfirm: (() => void) | undefined;
  root?: RefObject<HTMLElement | null>;
};

const stack: ModalEntry[] = [];

/** Portaled controls own Enter/Escape until their popup has closed. */
function hasOpenDropdown(): boolean {
  return !!document.querySelector(
    ".ant-select-dropdown:not(.ant-select-dropdown-hidden)," +
    ".ant-picker-dropdown:not(.ant-picker-dropdown-hidden)," +
    ".ant-dropdown:not(.ant-dropdown-hidden)," +
    ".ant-cascader-dropdown:not(.ant-cascader-dropdown-hidden)"
  );
}

/** Enter 무시해야 하는 포커스 상태인지 판별 */
function shouldSkipEnter(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;

  // textarea, contenteditable → Enter = 줄바꿈
  if (el.tagName === "TEXTAREA") return true;
  if (el.getAttribute?.("contenteditable") === "true") return true;

  // 버튼은 브라우저 기본 클릭에 맡기고, 선택형 컨트롤은 값 확정에 Enter를 사용한다.
  if (el.closest('button, a[href], select, [role="button"]')) return true;
  if (el.tagName === "INPUT") {
    const type = (el as HTMLInputElement).type;
    if (["checkbox", "radio", "file", "color", "range", "date", "time", "month", "week"].includes(type)) {
      return true;
    }
    if (el.getAttribute("aria-expanded") === "true") return true;
  }

  return false;
}

/** Disabled submit must never fall back to Cancel or a destructive action. */
function autoClickPrimary(root: HTMLElement | null): boolean {
  const button = root?.querySelector<HTMLButtonElement>('.modal-footer__actions button[data-intent="primary"]');
  if (!button || button.disabled || button.getClientRects().length === 0) return false;
  button.click();
  return true;
}

function globalKeyHandler(e: KeyboardEvent) {
  if (stack.length === 0) return;
  if (e.isComposing || e.defaultPrevented) return;

  // ConfirmDialog가 열려 있으면 ConfirmDialog 자체 핸들러에 위임
  if (document.querySelector("[data-confirm-dialog], [data-dialog-popover]")) return;

  // Do not close the parent form before Select/Picker/Dropdown can dismiss itself.
  if (hasOpenDropdown()) return;

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

    if (autoClickPrimary(top.root?.current ?? null)) {
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
  root?: RefObject<HTMLElement | null>,
) {
  // 최신 콜백을 ref 로 유지 → useEffect deps 에 콜백 넣지 않아 불필요 재등록 방지
  const ref = useRef<ModalEntry>({ onClose, onConfirm, root });
  ref.current = { onClose, onConfirm, root };

  useEffect(() => {
    if (!open) return;

    // 스택에 stable proxy entry 추가 (ref.current 를 호출)
    const entry: ModalEntry = {
      get onClose() { return ref.current.onClose; },
      get onConfirm() { return ref.current.onConfirm; },
      get root() { return ref.current.root; },
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
