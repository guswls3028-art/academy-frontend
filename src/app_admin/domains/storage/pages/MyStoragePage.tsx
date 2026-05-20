// PATH: src/app_admin/domains/storage/pages/MyStoragePage.tsx
// 내 저장소(선생님) 탭 페이지

import QuotaIndicator from "../components/QuotaIndicator";
import MyStorageExplorer from "../components/MyStorageExplorer";
import styles from "./MyStoragePage.module.css";

export default function MyStoragePage() {
  return (
    <>
      <div className={styles.quotaHeader}>
        <QuotaIndicator />
      </div>
      <MyStorageExplorer />
    </>
  );
}
