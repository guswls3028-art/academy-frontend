// PATH: src/app_admin/domains/storage/pages/MyStoragePage.tsx
// 내 저장소(선생님) 탭 페이지

import QuotaIndicator from "../components/QuotaIndicator";
import MyStorageExplorer from "../components/MyStorageExplorer";

export default function MyStoragePage() {
  return (
    <>
      <div style={{ flexShrink: 0, marginBottom: "var(--space-3)" }}>
        <QuotaIndicator />
      </div>
      <MyStorageExplorer />
    </>
  );
}
