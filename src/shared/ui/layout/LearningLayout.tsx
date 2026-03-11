// PATH: src/shared/ui/layout/LearningLayout.tsx
// 시험·성적·영상 — 메시지와 동일한 StorageStyleTabs 기반 레이아웃

import { Outlet } from "react-router-dom";
import { DomainLayout } from "@/shared/ui/layout";
import { StorageStyleTabs } from "@/shared/ui/domain";
import styles from "@/shared/ui/domain/StorageStyleTabs.module.css";

const LEARNING_TABS = [
  { key: "exams", label: "시험", path: "/admin/exams" },
  { key: "results", label: "성적", path: "/admin/results" },
  { key: "videos", label: "영상", path: "/admin/videos" },
];

export default function LearningLayout() {
  return (
    <DomainLayout
      title="학습관리"
      description="시험 · 성적 · 영상"
    >
      <div className={styles.wrap}>
        <StorageStyleTabs tabs={LEARNING_TABS} />
        <Outlet />
      </div>
    </DomainLayout>
  );
}
