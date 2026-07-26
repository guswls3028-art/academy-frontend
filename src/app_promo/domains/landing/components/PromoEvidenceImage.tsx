import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ImgHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { X, ZoomIn } from "lucide-react";
import styles from "./PromoEvidenceImage.module.css";

type PromoEvidenceImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  modalCaption?: string;
};

export default function PromoEvidenceImage({
  alt = "",
  modalCaption = "제품 화면 확대",
  onClick,
  onKeyDown,
  ...imageProps
}: PromoEvidenceImageProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLImageElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    const trigger = triggerRef.current;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key !== "Tab") return;

      event.preventDefault();
      closeRef.current?.focus();
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    window.requestAnimationFrame(() => closeRef.current?.focus());

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      trigger?.focus();
    };
  }, [open]);

  const handleClick = (event: ReactMouseEvent<HTMLImageElement>) => {
    onClick?.(event);
    if (!event.defaultPrevented) setOpen(true);
  };

  const handleImageKeyDown = (event: ReactKeyboardEvent<HTMLImageElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    setOpen(true);
  };

  return (
    <>
      <img
        {...imageProps}
        ref={triggerRef}
        alt={alt}
        role="button"
        tabIndex={0}
        aria-label={`${alt || "제품 화면"} 확대해서 보기`}
        onClick={handleClick}
        onKeyDown={handleImageKeyDown}
      />
      {open && createPortal(
        <div
          className={styles.backdrop}
          role="dialog"
          aria-modal="true"
          aria-label={modalCaption}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className={styles.dialog}>
            <div className={styles.toolbar}>
              <span>
                <ZoomIn size={17} aria-hidden="true" />
                {modalCaption}
              </span>
              <button ref={closeRef} type="button" onClick={() => setOpen(false)} aria-label="확대 화면 닫기">
                <X size={22} aria-hidden="true" />
              </button>
            </div>
            <div className={styles.canvas}>
              <img src={imageProps.src} alt={alt} />
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
