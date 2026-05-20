// PATH: src/app_admin/domains/settings/components/MiniAdminPreview.tsx
import styles from "./MiniAdminPreview.module.css";

export default function MiniAdminPreview() {
  return (
    <div className={styles.preview}>
      {/* Sidebar */}
      <div className={styles.sidebar}>
        {/* Brand / Logo */}
        <div className={styles.logoBox}>
          <div className={styles.logoDot} />
        </div>

        {/* Nav */}
        <div className={styles.nav}>
          <div className={`${styles.navLine} ${styles.navLineShort}`} />
          <div className={styles.navActive} />
          <div className={`${styles.navLine} ${styles.navLineMedium}`} />
          <div className={`${styles.navLine} ${styles.navLineLight}`} />
        </div>

        <div className={styles.spacer} />

        {/* Footer button */}
        <div className={styles.footerButton} />
      </div>

      {/* Main */}
      <div className={styles.main}>
        {/* Header bar */}
        <div className={styles.header} />

        {/* Content */}
        <div className={styles.content}>
          <div className={styles.panel} />
          <div className={`${styles.panel} ${styles.panelAccent}`} />
        </div>

        {/* CTA */}
        <div className={styles.cta} />
      </div>
    </div>
  );
}
