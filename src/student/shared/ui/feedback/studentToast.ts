// PATH: src/student/shared/ui/feedback/studentToast.ts
// 학생 앱용 간단한 토스트 — alert() 대체

let toastEl: HTMLDivElement | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;

function ensureContainer(): HTMLDivElement {
  if (toastEl) return toastEl;
  toastEl = document.createElement("div");
  toastEl.setAttribute("role", "status");
  toastEl.setAttribute("aria-live", "polite");
  Object.assign(toastEl.style, {
    position: "fixed",
    top: "calc(var(--stu-safe-top, 0px) + var(--stu-header-h, 48px) + 12px)",
    left: "50%",
    transform: "translateX(-50%) translateY(-8px)",
    zIndex: "9999",
    maxWidth: "min(90vw, 360px)",
    padding: "12px 20px",
    borderRadius: "12px",
    fontSize: "14px",
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
    success: { bg: "var(--stu-success, #16a34a)", text: "#fff" },
    error: { bg: "var(--stu-danger, #dc2626)", text: "#fff" },
    info: { bg: "var(--stu-surface, #f3f4f6)", text: "var(--stu-text, #111)" },
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

export const studentToast = {
  success: (msg: string) => show(msg, "success"),
  error: (msg: string) => show(msg, "error"),
  info: (msg: string) => show(msg, "info"),
};
