// PATH: src/shared/ui/confirm/ConfirmDialog.tsx
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ClipboardCheck } from "lucide-react";
import { useDraggableModal } from "@/shared/ui/modal/useDraggableModal";
import { ICON } from "@/shared/ui/ds";
import { setLocalItem } from "@/shared/utils/safeLocalStorage";
import "./confirm-dialog.css";

export type ConfirmReviewItem = {
  label: string;
  value: string;
  tone?: "default" | "accent" | "warning";
};

export type ConfirmReview = {
  eyebrow?: string;
  items: ConfirmReviewItem[];
  note?: string;
};

export type ConfirmOptions = {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  /**
   * 사용자가 "다음부터 묻지 않기" 체크 후 확인 → localStorage[rememberKey] = "1".
   * Provider가 다음 호출부터 dialog 띄우지 않고 즉시 true resolve.
   * 반복 액션(예: 매번 묻는 submit) 의 routine UX 최적화 용.
   */
  rememberKey?: string;
  /** 체크박스 라벨 (기본 "다음부터 묻지 않기"). rememberKey 와 함께 사용. */
  rememberLabel?: string;
  /** 저장 직전 핵심 값을 표처럼 다시 읽게 하는 고위험 작업용 검토표. */
  review?: ConfirmReview;
};

type Props = ConfirmOptions & {
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  title,
  message,
  confirmText = "확인",
  cancelText = "취소",
  danger = false,
  rememberKey,
  rememberLabel = "다음부터 묻지 않기",
  review,
  onConfirm,
  onCancel,
}: Props) {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const settledRef = useRef(false);
  const [remember, setRemember] = useState(false);
  const titleId = useId();
  const messageId = useId();
  const reviewId = useId();
  const hasReview = Boolean(review?.items.length);

  const safeConfirm = useCallback(() => {
    if (settledRef.current) return;
    settledRef.current = true;
    if (rememberKey && remember) {
      setLocalItem(rememberKey, "1");
    }
    onConfirm();
  }, [onConfirm, remember, rememberKey]);

  const safeCancel = useCallback(() => {
    if (settledRef.current) return;
    settledRef.current = true;
    onCancel();
  }, [onCancel]);

  const { offset, onMouseDown, onTouchStart } = useDraggableModal(
    ".confirm-drag-handle",
    { enableMinimize: false },
  );

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    const visibleParentModalContents = Array.from(
      document.querySelectorAll<HTMLElement>(".admin-modal-wrap .admin-modal__inner"),
    ).filter((element) => element.getClientRects().length > 0);
    const parentModalContent = visibleParentModalContents[visibleParentModalContents.length - 1] ?? null;
    const parentModalHost = parentModalContent?.closest<HTMLElement>(".ant-modal") ?? null;
    const previousParentInert = parentModalContent?.inert ?? false;
    const previousParentAriaHidden = parentModalContent?.getAttribute("aria-hidden") ?? null;
    const previousHostInert = parentModalHost?.inert ?? false;
    const previousHostAriaHidden = parentModalHost?.getAttribute("aria-hidden") ?? null;
    document.body.style.overflow = "hidden";
    if (parentModalHost) {
      parentModalHost.inert = true;
      parentModalHost.setAttribute("aria-hidden", "true");
    }
    if (parentModalContent) {
      parentModalContent.inert = true;
      parentModalContent.setAttribute("aria-hidden", "true");
    }

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        safeCancel();
      } else if (e.key === "Enter") {
        // 검토표가 있는 안전 확인은 기본 포커스(취소)를 그대로 활성화한다.
        // 연속 Enter 입력이 곧바로 생성 요청까지 통과하지 않게 한다.
        if (hasReview) return;
        // input/textarea/select/contenteditable에서는 Enter 무시
        const tag = (e.target as HTMLElement)?.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          (e.target as HTMLElement)?.isContentEditable
        ) {
          return;
        }
        e.preventDefault();
        e.stopImmediatePropagation();
        safeConfirm();
      } else if (e.key === "Tab") {
        const focusable = Array.from(
          cardRef.current?.querySelectorAll<HTMLElement>(
            "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex='-1'])",
          ) ?? [],
        ).filter((element) => element.getClientRects().length > 0);
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    const focusInitialAction = () => {
      const target = hasReview ? cancelBtnRef.current : confirmBtnRef.current;
      target?.focus({ preventScroll: true });
    };
    document.addEventListener("keydown", handler, true);
    focusInitialAction();
    // Ant Design 기반 부모 모달의 자체 초기 포커스보다 한 프레임 뒤에
    // 최상위 확인창 포커스를 확정한다.
    const focusFrame = window.requestAnimationFrame(focusInitialAction);
    const focusTimers = [60, 180, 360].map((delay) => window.setTimeout(() => {
      if (!cardRef.current?.contains(document.activeElement)) focusInitialAction();
    }, delay));
    return () => {
      window.cancelAnimationFrame(focusFrame);
      focusTimers.forEach((timer) => window.clearTimeout(timer));
      document.removeEventListener("keydown", handler, true);
      document.body.style.overflow = previousOverflow;
      if (parentModalContent) {
        parentModalContent.inert = previousParentInert;
        if (previousParentAriaHidden === null) parentModalContent.removeAttribute("aria-hidden");
        else parentModalContent.setAttribute("aria-hidden", previousParentAriaHidden);
      }
      if (parentModalHost) {
        parentModalHost.inert = previousHostInert;
        if (previousHostAriaHidden === null) parentModalHost.removeAttribute("aria-hidden");
        else parentModalHost.setAttribute("aria-hidden", previousHostAriaHidden);
      }
      previouslyFocused?.focus();
    };
  }, [hasReview, safeCancel, safeConfirm]);

  const hasOffset = offset.x !== 0 || offset.y !== 0;
  return createPortal(
    <div
      data-confirm-dialog
      className="confirm-dialog__backdrop"
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onMouseUp={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!hasReview) safeCancel();
      }}
    >
      <div
        className={`confirm-dialog__positioner${hasReview ? " confirm-dialog__positioner--review" : ""}`}
        style={hasOffset ? { transform: `translate(${offset.x}px, ${offset.y}px)` } : undefined}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
      >
        <div
          ref={cardRef}
          className={`confirm-dialog__card${hasReview ? " confirm-dialog__card--review" : ""}`}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={`${messageId}${hasReview ? ` ${reviewId}` : ""}`}
          onClick={(e) => e.stopPropagation()}
        >
          {hasReview ? (
            <div className="confirm-dialog__review-heading confirm-drag-handle">
              <span className="confirm-dialog__review-mark" aria-hidden>
                <ClipboardCheck size={ICON.md} strokeWidth={1.9} />
              </span>
              <div>
                <span className="confirm-dialog__eyebrow">{review?.eyebrow ?? "저장 전 검토"}</span>
                <h3 id={titleId} className="confirm-dialog__title">{title}</h3>
              </div>
            </div>
          ) : (
            <h3 id={titleId} className="confirm-dialog__title confirm-drag-handle">{title}</h3>
          )}
          <p id={messageId} className="confirm-dialog__message">{message}</p>
          {hasReview && review && (
            <div id={reviewId} className="confirm-dialog__review">
              <dl className="confirm-dialog__review-list">
                {review.items.map((item, index) => (
                  <div
                    key={`${item.label}-${index}`}
                    className="confirm-dialog__review-row"
                    data-tone={item.tone ?? "default"}
                  >
                    <dt>{item.label}</dt>
                    <dd>{item.value}</dd>
                  </div>
                ))}
              </dl>
              {review.note && <p className="confirm-dialog__review-note">{review.note}</p>}
            </div>
          )}
          {rememberKey && (
            <label className="confirm-dialog__remember">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="confirm-dialog__remember-checkbox"
              />
              <span>{rememberLabel}</span>
            </label>
          )}
          <div className="confirm-dialog__actions">
            <button
              ref={cancelBtnRef}
              type="button"
              autoFocus={hasReview}
              className="confirm-dialog__button confirm-dialog__button--cancel"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                safeCancel();
              }}
            >
              {cancelText}
            </button>
            <button
              ref={confirmBtnRef}
              type="button"
              autoFocus={!hasReview}
              className={`confirm-dialog__button ${danger ? "confirm-dialog__button--danger" : "confirm-dialog__button--confirm"}`}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                safeConfirm();
              }}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
