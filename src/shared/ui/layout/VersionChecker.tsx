import { useCallback } from "react";
import { hardReloadWithCacheBust } from "@/shared/utils/hardReload";
import styles from "./VersionChecker.module.css";

export function VersionUpdateNotice({ visible }: { visible: boolean }) {
  const refresh = useCallback(() => {
    hardReloadWithCacheBust({ key: "manual_version_reload_ts", cooldownMs: 0 });
  }, []);

  if (!visible) return null;

  return (
    <aside className={styles.notice} role="status" aria-live="polite">
      <div className={styles.copy}>
        <strong>새 버전이 준비됐어요</strong>
        <span>현재 영상과 작업은 유지됩니다. 편한 때 반영해 주세요.</span>
      </div>
      <button type="button" className={styles.refresh} onClick={refresh}>
        지금 새로고침
      </button>
    </aside>
  );
}
