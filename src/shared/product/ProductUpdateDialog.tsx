import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { ICON } from "@/shared/ui/ds";
import { ProductUpdateNotes } from "./ProductUpdateNotes";
import styles from "./ProductUpdateNotes.module.css";

export function ProductUpdateDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
    >
      <header className={styles.dialogHeader}>
        <h2 id={titleId}>패치노트</h2>
        <button
          type="button"
          className={styles.close}
          aria-label="패치노트 닫기"
          onClick={() => dialogRef.current?.close()}
        >
          <X size={ICON.lg} aria-hidden />
        </button>
      </header>
      <div className={styles.dialogBody} tabIndex={0} role="region" aria-label="변경 내용">
        <ProductUpdateNotes />
      </div>
    </dialog>
  );
}
