import { useState } from "react";
import styles from "./AuthUnavailableState.module.css";

export default function AuthUnavailableState({ retry }: { retry: () => Promise<void> }) {
  const [retrying, setRetrying] = useState(false);

  const onRetry = async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      await retry();
    } catch {
      // AuthContext keeps the unavailable state until a retry succeeds.
    } finally {
      setRetrying(false);
    }
  };

  return (
    <main className={styles.root}>
      <section className={styles.card} role="alert" aria-live="polite">
        <h1 className={styles.title}>로그인 상태를 확인하지 못했습니다</h1>
        <p className={styles.description}>
          일시적인 연결 문제일 수 있습니다. 로그인 정보는 유지했으니 다시 시도해 주세요.
        </p>
        <button className={styles.retry} type="button" onClick={onRetry} disabled={retrying}>
          {retrying ? "확인 중…" : "다시 시도"}
        </button>
      </section>
    </main>
  );
}
