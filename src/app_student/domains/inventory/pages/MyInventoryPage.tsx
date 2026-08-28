/**
 * 내 인벤토리 페이지 — DomainTabShell 기반 (홈 | 통계)
 * 홈: 파일 브라우저 (업로드, 다운로드, 삭제)
 * 통계: 저장소 용량, 파일 타입 분포
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DomainTabShell from "@student/shared/ui/pages/DomainTabShell";
import { IconFolder } from "@student/shared/ui/icons/Icons";
import { fetchMyProfile } from "@student/domains/profile/api/profile.api";
import { studentQueryKeys } from "@student/shared/api/queryKeys";
import { fetchMyInventory } from "../api/inventory.api";
import InventoryHomeTab from "../components/InventoryHomeTab";
import InventoryStatsTab from "../components/InventoryStatsTab";
import { Button, EmptyState } from "@/shared/ui/ds";

const TABS = [
  { key: "home", label: "자료함" },
  { key: "stats", label: "용량 분석" },
];

export default function MyInventoryPage() {
  const [tab, setTab] = useState("home");

  const profileQ = useQuery({
    queryKey: studentQueryKeys.me,
    queryFn: fetchMyProfile,
  });
  const profile = profileQ.data;

  const ps = profile?.ps_number || "";
  const queryKey = studentQueryKeys.inventory(ps);

  const inventoryQ = useQuery({
    queryKey,
    queryFn: () => fetchMyInventory(ps),
    enabled: !!ps,
  });
  const inventory = inventoryQ.data;

  const isLoading = profileQ.isLoading || inventoryQ.isLoading;
  const isError = profileQ.isError || inventoryQ.isError || (!profileQ.isLoading && !profileQ.isError && !ps);
  const isParentReadOnly = !!profile?.isParentReadOnly;
  const folders = inventory?.folders ?? [];
  const files = inventory?.files ?? [];
  const shellTitle = tab === "stats" ? "자료 현황" : "학습 자료함";
  const shellDescription =
    tab === "stats"
      ? "파일 종류와 저장 용량을 정리해서 보여줍니다."
      : "제출한 파일과 선생님이 공유한 자료를 모아봅니다.";

  return (
    <DomainTabShell
      title={shellTitle}
      eyebrow="자료 관리"
      description={shellDescription}
      icon={<IconFolder />}
      tabs={TABS}
      activeTab={tab}
      onTabChange={setTab}
    >
      {isLoading && (
        <div className="stu-skel-stack stu-skel-stack--compact">
          {[1, 2, 3].map((i) => (
            <div key={i} className="stu-skel stu-skel--sm" />
          ))}
        </div>
      )}

      {!isLoading && isError && (
        <div role="alert">
          <EmptyState
            scope="panel"
            tone="error"
            title="자료함을 불러오지 못했습니다"
            description="빈 자료함으로 표시하지 않고 업로드·삭제 작업을 잠갔습니다."
            actions={<Button intent="secondary" onClick={() => { void profileQ.refetch(); if (ps) void inventoryQ.refetch(); }}>다시 시도</Button>}
          />
        </div>
      )}

      {!isLoading && !isError && tab === "home" && (
        <InventoryHomeTab
          ps={ps}
          folders={folders}
          files={files}
          isParentReadOnly={isParentReadOnly}
          queryKey={queryKey}
        />
      )}

      {!isLoading && !isError && tab === "stats" && (
        <InventoryStatsTab files={files} folders={folders} />
      )}
    </DomainTabShell>
  );
}
