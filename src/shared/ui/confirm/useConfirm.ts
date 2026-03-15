// PATH: src/shared/ui/confirm/useConfirm.ts
import { useContext } from "react";
import { ConfirmContext } from "./ConfirmProvider";
import type { ConfirmOptions } from "./ConfirmDialog";

/** ConfirmProvider 밖에서 호출 시 window.confirm fallback */
const fallbackConfirm = (options: ConfirmOptions): Promise<boolean> => {
  const msg = options.message || options.title || "계속하시겠습니까?";
  return Promise.resolve(window.confirm(msg));
};

export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  return confirm ?? fallbackConfirm;
}
