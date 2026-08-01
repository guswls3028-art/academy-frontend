/**
 * VideoDomainLayout
 * 영상 도메인 전역 레이아웃 — DomainLayout SSOT로 탭 제공.
 * 라우트: /workspace/videos (오늘의 작업), /workspace/videos/tree (폴더별 탐색)
 */

import { Outlet } from "react-router";
import { DomainLayout } from "@/shared/ui/layout";
import type { DomainTab } from "@/shared/ui/domain";

const VIDEO_TABS: DomainTab[] = [
  { key: "inbox", label: "오늘의 작업", path: "/workspace/videos", exact: true },
  { key: "tree", label: "폴더별 탐색", path: "/workspace/videos/tree", exact: true },
];

export default function VideoDomainLayout() {
  return (
    <DomainLayout title="영상" tabs={VIDEO_TABS}>
      <Outlet />
    </DomainLayout>
  );
}
