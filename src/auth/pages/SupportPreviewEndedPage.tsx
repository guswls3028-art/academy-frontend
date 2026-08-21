import styles from "./SupportPreviewEndedPage.module.css";

export default function SupportPreviewEndedPage() {
  return (
    <main className={styles.root}>
      <section className={styles.card}>
        <div aria-hidden className={styles.accent} />
        <h1 className={styles.title}>학생 화면 보기가 끝났습니다</h1>
        <p className={styles.description}>
          안전을 위해 대리보기는 15분 후 자동 종료됩니다. 학생 정보에서 다시 열 수 있습니다.
        </p>
        <button type="button" onClick={() => window.close()} className={styles.closeButton}>
          창 닫기
        </button>
      </section>
    </main>
  );
}
