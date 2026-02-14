// PATH: src/features/storage/pages/StoragePage.tsx
// 저장소 통합 — 뷰 스위처: 내 저장소(선생님) | 학생 인벤토리 관리

import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { DomainLayout } from "@/shared/ui/domain/DomainLayout";
import { Button } from "@/shared/ui/ds";
import MyStorageExplorer from "../components/MyStorageExplorer";
import StudentInventoryManage from "../components/StudentInventoryManage";
import QuotaIndicator from "../components/QuotaIndicator";
import styles from "./StoragePage.module.css";

type StorageTab = "mine" | "students";

export default function StoragePage() {
  const { studentPs } = useParams<{ studentPs?: string }>();
  const [tab, setTab] = useState<StorageTab>(studentPs ? "students" : "mine");
  // URL에 studentPs가 있으면 학생 인벤토리 탭으로
  if (studentPs && tab !== "students") setTab("students");

  return (
    <DomainLayout
      title="저장소"
      description="선생님 파일과 학생 인벤토리를 통합 관리합니다."
    >
      <div className={styles.wrap}>
        {/* 뷰 스위처 */}
        <div className={styles.tabs}>
          <button
            type="button"
            className={styles.tab + (tab === "mine" ? " " + styles.tabActive : "")}
            onClick={() => setTab("mine")}
          >
            내 저장소(선생님)
          </button>
          <button
            type="button"
            className={styles.tab + (tab === "students" ? " " + styles.tabActive : "")}
            onClick={() => setTab("students")}
          >
            학생 인벤토리 관리
          </button>
        </div>

        {/* 용량 인디케이터 */}
        <QuotaIndicator className={styles.quota} />

        {/* 탭 콘텐츠 */}
        {tab === "mine" && <MyStorageExplorer />}
        {tab === "students" && (
          <StudentInventoryManage
            initialStudentPs={studentPs}
            onOpenStudent={(ps) => setTab("students")}
          />
        )}
      </div>
    </DomainLayout>
  );
}
