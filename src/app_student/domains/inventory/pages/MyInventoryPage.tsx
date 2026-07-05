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

const TABS = [
  { key: "home", label: "자료함" },
  { key: "stats", label: "용량 분석" },
];

export default function MyInventoryPage() {
  const [tab, setTab] = useState("home");

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: studentQueryKeys.me,
    queryFn: fetchMyProfile,
  });

  const ps = profile?.ps_number || "";
  const queryKey = studentQueryKeys.inventory(ps);

  const { data: inventory, isLoading: invLoading } = useQuery({
    queryKey,
    queryFn: () => fetchMyInventory(ps),
    enabled: !!ps,
  });

  const isLoading = profileLoading || invLoading;
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

      {!isLoading && tab === "home" && (
        <InventoryHomeTab
          ps={ps}
          folders={folders}
          files={files}
          isParentReadOnly={isParentReadOnly}
          queryKey={queryKey}
        />
      )}

      {!isLoading && tab === "stats" && (
        <InventoryStatsTab files={files} folders={folders} />
      )}
    </DomainTabShell>
  );
}
