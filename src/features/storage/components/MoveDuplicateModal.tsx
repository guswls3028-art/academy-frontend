// PATH: src/features/storage/components/MoveDuplicateModal.tsx
// 이동 시 목적지에 같은 이름이 있을 때 덮어쓰기/이름 변경 선택

import { Button, CloseButton } from "@/shared/ui/ds";
import styles from "./MyStorageExplorer.module.css";

type MoveDuplicateModalProps = {
  existingName: string;
  itemType: "file" | "folder";
  onOverwrite: () => void;
  onRename: () => void;
  onCancel: () => void;
};

export default function MoveDuplicateModal({
  existingName,
  itemType,
  onOverwrite,
  onRename,
  onCancel,
}: MoveDuplicateModalProps) {
  const label = itemType === "folder" ? "폴더" : "파일";
  return (
    <div className={styles.modalBackdrop} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span>이름 충돌</span>
          <CloseButton onClick={onCancel} />
        </div>
        <div className={styles.modalBody}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-primary)" }}>
            목적지에 같은 이름의 {label}(&quot;{existingName}&quot;)이(가) 있습니다.
          </p>
          <p style={{ margin: "var(--space-2) 0 0", fontSize: 12, color: "var(--color-text-muted)" }}>
            덮어쓰기하거나 이름을 변경(예: {itemType === "file" ? "파일_복사본.pdf" : "폴더_복사본"})할 수 있습니다.
          </p>
        </div>
        <div className={styles.modalFooter}>
          <Button size="sm" intent="secondary" onClick={onCancel}>
            취소
          </Button>
          <Button size="sm" intent="secondary" onClick={onRename}>
            이름 변경
          </Button>
          <Button size="sm" intent="primary" onClick={onOverwrite}>
            덮어쓰기
          </Button>
        </div>
      </div>
    </div>
  );
}
