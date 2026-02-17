// PATH: src/features/storage/pages/StoragePage.tsx
// 저장소 통합 — 뷰 스위처: 내 저장소(선생님) | 학생 인벤토리 관리

import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import DomainLayout from "@/shared/ui/domain/DomainLayout";
import MyStorageExplorer from "../components/MyStorageExplorer";
import StudentInventoryManage from "../components/StudentInventoryManage";
import QuotaIndicator from "../components/QuotaIndicator";
import sharedStyles from "@/shared/ui/domain/StorageStyleTabs.module.css";

type StorageTab = "mine" | "students";

export default function StoragePage() {
  const { studentPs } = useParams<{ studentPs?: string }>();
  const [tab, setTab] = useState<StorageTab>(studentPs ? "students" : "mine");
  useEffect(() => {
    if (studentPs) setTab("students");
  }, [studentPs]);

  return (
    <DomainLayout
      title="저장소"
      description="선생님 파일과 학생 인벤토리를 통합 관리합니다."
    >
      <div className={sharedStyles.wrap}>
        {/* 뷰 스위처 */}
        <div className={sharedStyles.tabs}>
          <button
            type="button"
            className={sharedStyles.tab + (tab === "mine" ? " " + sharedStyles.tabActive : "")}
            onClick={() => setTab("mine")}
          >
            내 저장소(선생님)
          </button>
          <button
            type="button"
            className={sharedStyles.tab + (tab === "students" ? " " + sharedStyles.tabActive : "")}
            onClick={() => setTab("students")}
          >
            학생 인벤토리 관리
          </button>
        </div>

        {/* 용량 인디케이터 */}
        <div style={{ flexShrink: 0 }}>
          <QuotaIndicator />
        </div>

        {/* 탭 콘텐츠 */}
        {tab === "mine" && <MyStorageExplorer />}
        {tab === "students" && (
          <StudentInventoryManage
            initialStudentPs={studentPs ?? undefined}
            onOpenStudent={() => setTab("students")}
          />
        )}
      </div>
    </DomainLayout>
  );
}
