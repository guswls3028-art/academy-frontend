// PATH: src/app_admin/domains/notice/overlays/NoticeOverlay.tsx
import Panel from "@/shared/ui/ds/Panel";
import { Button } from "@/shared/ui/ds";
import { useNotices } from "../context/useNotices";
import styles from "./NoticeOverlay.module.css";

export default function NoticeOverlay({ onClose }: { onClose: () => void }) {
  const { notices, remove, clear } = useNotices();

  return (
    <div className={styles.backdrop}>
      <div className={styles.drawer}>
        <div className={styles.header}>
          <div className={styles.title}>알림</div>

          <div className={styles.actions}>
            <Button type="button" intent="ghost" size="sm" onClick={clear} className="text-xs font-black text-[var(--color-text-muted)]">
              모두 지우기
            </Button>
            <Button type="button" intent="ghost" size="sm" onClick={onClose} className="text-xs font-black text-[var(--color-text-muted)]">
              닫기
            </Button>
          </div>
        </div>

        <div className={styles.body}>
          {notices.length === 0 && (
            <div className={styles.empty}>
              알림이 없습니다
            </div>
          )}

          <div className={styles.list}>
            {notices.map((n) => (
              <Panel
                key={n.id}
                title={
                  <div className={styles.noticeHeader}>
                    <div className={styles.noticeTitleRow}>
                      <span className={styles.levelDot} data-level={n.level} />
                      <div
                        className={styles.noticeTitle}
                        title={n.title}
                      >
                        {n.title}
                      </div>
                    </div>

                    <Button
                      type="button"
                      intent="ghost"
                      size="sm"
                      onClick={() => remove(n.id)}
                      className="text-xs font-black text-[var(--color-text-muted)]"
                      aria-label="알림 제거"
                      title="알림 제거"
                    >
                      ✕
                    </Button>
                  </div>
                }
              >
                {n.body && (
                  <div className={styles.noticeBody}>
                    {n.body}
                  </div>
                )}

                <div className={styles.noticeTime}>
                  {new Date(n.created_at).toLocaleString("ko-KR")}
                </div>
              </Panel>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
