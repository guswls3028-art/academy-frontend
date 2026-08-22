import styles from "./SupportPreviewEndedPage.module.css";

export default function SupportPreviewEndedPage() {
  return (
    <main className={styles.root}>
      <section className={styles.card}>
        <div aria-hidden className={styles.accent} />
        <h1 className={styles.title}>학생 화면 보기가 끝났습니다</h1>
        <p className={styles.description}>
          대리보기 전용 접근 권한을 종료했습니다. 학생의 원래 로그인 상태와 활동 기록에는 영향이 없습니다.
        </p>
        <button type="button" onClick={() => window.close()} className={styles.closeButton}>
          창 닫기
        </button>
      </section>
    </main>
  );
}
