import { useContext, useEffect } from 'react';
import { UNSAFE_NavigationContext, type To } from 'react-router';

/** BrowserRouter has no data-router blocker. Fence its navigator while this form is dirty. */
export function useScheduleLeaveGuard(lectureId: number, sessionId: number, dirty: boolean, busy: boolean) {
  const { navigator } = useContext(UNSAFE_NavigationContext);
  useEffect(() => {
    if (!dirty && !busy) return;
    const prefix = `/workspace/lectures/${lectureId}/sessions/${sessionId}`;
    const stays = (to: To) => {
      const pathname = typeof to === 'string' ? new URL(to, window.location.href).pathname : to.pathname ?? window.location.pathname;
      return pathname === prefix || pathname.startsWith(`${prefix}/`);
    };
    const approve = () => !busy && window.confirm('저장하지 않은 수업일 설정이 있습니다. 작성 내용을 버리고 이동할까요?');
    const originalPush = navigator.push;
    const originalReplace = navigator.replace;
    let currentIndex = Number(window.history.state?.idx ?? 0);
    let restoring = false;
    const push: typeof navigator.push = (...args) => {
      if (!stays(args[0]) && !approve()) return;
      originalPush.apply(navigator, args);
      currentIndex = Number(window.history.state?.idx ?? currentIndex);
    };
    const replace: typeof navigator.replace = (...args) => {
      if (!stays(args[0]) && !approve()) return;
      originalReplace.apply(navigator, args);
      currentIndex = Number(window.history.state?.idx ?? currentIndex);
    };
    const pop = (event: PopStateEvent) => {
      const nextIndex = Number(event.state?.idx ?? currentIndex);
      if (restoring) { restoring = false; event.stopImmediatePropagation(); return; }
      if (!stays(window.location.pathname) && !approve()) {
        event.stopImmediatePropagation();
        restoring = true;
        window.history.go(currentIndex - nextIndex);
        return;
      }
      currentIndex = nextIndex;
    };
    navigator.push = push;
    navigator.replace = replace;
    window.addEventListener('popstate', pop, true);
    return () => {
      if (navigator.push === push) navigator.push = originalPush;
      if (navigator.replace === replace) navigator.replace = originalReplace;
      window.removeEventListener('popstate', pop, true);
    };
  }, [busy, dirty, lectureId, navigator, sessionId]);
}
