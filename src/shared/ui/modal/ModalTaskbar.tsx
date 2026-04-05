// PATH: src/shared/ui/modal/ModalTaskbar.tsx
// 하단 태스크바 — 최소화된 모달을 탭으로 표시
import { useModalWindow } from "./ModalWindowContext";

export default function ModalTaskbar() {
  const ctx = useModalWindow();
  if (!ctx || ctx.modals.length === 0) return null;

  return (
    <div className="modal-taskbar">
      <div className="modal-taskbar__inner">
        {ctx.modals.map((modal) => (
          <div key={modal.id} className="modal-taskbar__tab">
            <button
              type="button"
              className="modal-taskbar__tab-restore"
              onClick={() => ctx.restore(modal.id)}
            >
              <span
                className={`modal-taskbar__tab-dot modal-taskbar__tab-dot--${modal.type}`}
              />
              <span className="modal-taskbar__tab-title">{modal.title}</span>
            </button>
            <button
              type="button"
              className="modal-taskbar__tab-close"
              onClick={() => {
                ctx.remove(modal.id);
                modal.onClose();
              }}
              aria-label="닫기"
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                fill="none"
              >
                <path
                  d="M1 1l8 8M9 1l-8 8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
