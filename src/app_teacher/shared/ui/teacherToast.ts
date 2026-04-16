// PATH: src/app_teacher/shared/ui/teacherToast.ts
// 선생 앱용 간단한 토스트

let toastEl: HTMLDivElement | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;

function ensureContainer(): HTMLDivElement {
  if (toastEl) return toastEl;
  toastEl = document.createElement("div");
  toastEl.setAttribute("role", "status");
  toastEl.setAttribute("aria-live", "polite");
  Object.assign(toastEl.style, {
    position: "fixed",
    top: "12px",
    left: "50%",
    transform: "translateX(-50%) translateY(-8px)",
    zIndex: "9999",
    maxWidth: "min(90vw, 360px)",
    padding: "10px 18px",
    borderRadius: "var(--tc-radius, 10px)",
    fontSize: "13px",
    fontWeight: "600",
    textAlign: "center",
    opacity: "0",
    transition: "opacity 200ms ease, transform 200ms ease",
    pointerEvents: "none",
  });
  document.body.appendChild(toastEl);
  return toastEl;
}

function show(message: string, type: "success" | "error" | "info") {
  const el = ensureContainer();

  const colors = {
    success: { bg: "var(--tc-success, #16a34a)", text: "#fff" },
    error: { bg: "var(--tc-danger, #dc2626)", text: "#fff" },
    info: { bg: "var(--tc-surface, #f3f4f6)", text: "var(--tc-text, #111)" },
  };
  const c = colors[type];

  el.textContent = message;
  Object.assign(el.style, {
    background: c.bg,
    color: c.text,
    opacity: "1",
    transform: "translateX(-50%) translateY(0)",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
  });

  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    Object.assign(el.style, {
      opacity: "0",
      transform: "translateX(-50%) translateY(-8px)",
    });
  }, 2500);
}

export const teacherToast = {
  success: (msg: string) => show(msg, "success"),
  error: (msg: string) => show(msg, "error"),
  info: (msg: string) => show(msg, "info"),
};
