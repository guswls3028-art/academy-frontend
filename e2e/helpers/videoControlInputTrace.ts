import type { Page, TestInfo } from "@playwright/test";

type InputTraceWindow = Window & {
  __qaVideoControlTrace?: { events: unknown[]; stop: () => void };
};

/** Observe real input and media events; never replace the range or media setters. */
export async function withVideoControlInputTrace(page: Page, info: TestInfo, name: string, action: () => Promise<void>) {
  await page.evaluate(() => {
    const audit = window as InputTraceWindow;
    audit.__qaVideoControlTrace?.stop();
    const events: unknown[] = [];
    const record = (event?: Event) => {
      if (events.length >= 100) return;
      const range = document.querySelector<HTMLInputElement>('.svpControls input[aria-label="진행 바"]');
      const video = document.querySelector<HTMLVideoElement>("video.svpVideo");
      const target = event?.target instanceof Element ? event.target : null;
      const rect = range?.getBoundingClientRect();
      events.push({ type: event?.type ?? "ready", at: performance.now(), trusted: event?.isTrusted,
        target: target?.tagName, label: target?.getAttribute("aria-label"),
        pointer: event instanceof PointerEvent ? { type: event.pointerType, x: event.clientX, y: event.clientY } : null,
        value: range?.value, rect: rect && { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
        controlsHidden: !!range?.closest(".svpPlayerWrap--controlsHidden"),
        currentTime: video?.currentTime, seeking: video?.seeking, paused: video?.paused, readyState: video?.readyState });
    };
    const types = ["pointerdown", "pointerup", "pointercancel", "click", "input", "change", "seeking", "seeked", "emptied", "loadedmetadata"];
    for (const type of types) document.addEventListener(type, record, true);
    audit.__qaVideoControlTrace = { events, stop: () => {
      for (const type of types) document.removeEventListener(type, record, true);
    } };
    record();
  });
  try {
    await action();
  } finally {
    const events = await page.evaluate(() => {
      const audit = window as InputTraceWindow;
      const trace = audit.__qaVideoControlTrace;
      trace?.stop();
      delete audit.__qaVideoControlTrace;
      return trace?.events ?? [];
    }).catch(() => []);
    await info.attach(name, { contentType: "application/json", body: JSON.stringify(events) });
  }
}
