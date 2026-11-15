import { useId, useRef, useState } from "react";
import { FileText, X } from "lucide-react";
import { ICON } from "@/shared/ui/ds";
import { ProductUpdateNotes } from "./ProductUpdateNotes";
import { useProductUpdateAwareness } from "./useProductUpdateAwareness";
import styles from "./ProductUpdateNotes.module.css";

export function ProductUpdateLauncher({ userId }: { userId?: string | number | null }) {
  const { isUnread, markRead } = useProductUpdateAwareness(userId);
  const [showNotes, setShowNotes] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        aria-label={isUnread ? "업데이트, 새 패치노트" : "업데이트"}
        aria-haspopup="dialog"
        title="업데이트"
        onClick={() => {
          dialogRef.current?.showModal();
          setShowNotes(true);
          markRead();
        }}
      >
        <FileText size={ICON.md} aria-hidden />
        <span className={styles.triggerLabel}>업데이트</span>
        {isUnread && <span className={styles.unread} aria-hidden />}
      </button>
      <dialog
        ref={dialogRef}
        className={styles.dialog}
        aria-labelledby={titleId}
        onClose={() => setShowNotes(false)}
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
          {showNotes && <ProductUpdateNotes />}
        </div>
      </dialog>
    </>
  );
}
