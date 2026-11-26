import { useCallback, useContext, useEffect, useRef } from "react";
import { UNSAFE_NavigationContext } from "react-router";
import { feedback } from "@/shared/ui/feedback/feedback";
import { usePostDraftNavigation } from "./usePostDraftNavigation";

/** BrowserRouter does not expose a data-router blocker. Preserve the board draft on links and browser Back. */
export function useLectureBoardNavigation() {
  const { navigator } = useContext(UNSAFE_NavigationContext);
  const draft = usePostDraftNavigation();
  const { hasPending, hasBusy, run } = draft;
  const approved = useRef(false);
  const proceed = useCallback((action: () => void) => {
    approved.current = true;
    try {
      action();
    } finally {
      approved.current = false;
    }
  }, []);

  useEffect(() => {
    const push = navigator.push;
    const replace = navigator.replace;
    let index = Number(window.history.state?.idx ?? 0);
    let restoring = false;
    const guard = (action: () => void) => {
      const navigate = () => {
        action();
        index = Number(window.history.state?.idx ?? index);
      };
      if (!approved.current && hasPending()) void run(navigate);
      else navigate();
    };
    const guardedPush: typeof push = (...args) => guard(() => push.apply(navigator, args));
    const guardedReplace: typeof replace = (...args) => guard(() => replace.apply(navigator, args));
    const back = (event: PopStateEvent) => {
      if (restoring) {
        restoring = false;
        event.stopImmediatePropagation();
        return;
      }
      const next = Number(event.state?.idx ?? index);
      if (hasPending() && next !== index) {
        const busy = hasBusy();
        if (busy || !window.confirm("저장하지 않은 내용과 선택한 파일을 버리고 이동할까요?")) {
          if (busy) feedback.info("저장이 끝난 뒤 이동해 주세요.");
          event.stopImmediatePropagation();
          restoring = true;
          window.history.go(index - next);
          return;
        }
      }
      index = next;
    };
    navigator.push = guardedPush;
    navigator.replace = guardedReplace;
    window.addEventListener("popstate", back, true);
    return () => {
      if (navigator.push === guardedPush) navigator.push = push;
      if (navigator.replace === guardedReplace) navigator.replace = replace;
      window.removeEventListener("popstate", back, true);
    };
  }, [hasBusy, hasPending, navigator, run]);

  return { ...draft, proceed };
}
