// PATH: src/shared/ui/confirm/useConfirm.ts
import { useContext } from "react";
import { ConfirmContext } from "./ConfirmProvider";
import type { ConfirmOptions } from "./ConfirmDialog";

let warned = false;

/**
 * ConfirmProvider 밖에서 호출 시 fallback.
 * 운영에서는 main.tsx에서 항상 ConfirmProvider로 래핑되므로 도달 불가.
 * dev에서 잘못 사용된 경우 console.error로 즉시 발견 가능하게 한다.
 */
const fallbackConfirm = (options: ConfirmOptions): Promise<boolean> => {
  if (!warned) {
    warned = true;
    console.error(
      "[useConfirm] ConfirmProvider 외부에서 호출됨. <ConfirmProvider>로 앱을 래핑하세요.",
      options,
    );
  }
  const msg = options.message || options.title || "계속하시겠습니까?";
  return Promise.resolve(window.confirm(msg));
};

export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  return confirm ?? fallbackConfirm;
}
