/**
 * 내 인벤토리 페이지 — DomainTabShell 기반 (홈 | 통계)
 * 홈: 파일 브라우저 (업로드, 다운로드, 삭제)
 * 통계: 저장소 용량, 파일 타입 분포
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DomainTabShell from "@student/shared/ui/pages/DomainTabShell";
import { fetchMyProfile } from "@student/domains/profile/api/profile.api";
import { fetchMyInventory } from "../api/inventory.api";
import InventoryHomeTab from "../components/InventoryHomeTab";
import InventoryStatsTab from "../components/InventoryStatsTab";

const TABS = [
  { key: "home", label: "홈" },
  { key: "stats", label: "통계" },
];

export default function MyInventoryPage() {
  const [tab, setTab] = useState("home");

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["student", "me"],
    queryFn: fetchMyProfile,
  });

  const ps = profile?.ps_number || "";
  const queryKey = ["student-inventory", ps] as const;

  const { data: inventory, isLoading: invLoading } = useQuery({
    queryKey,
    queryFn: () => fetchMyInventory(ps),
    enabled: !!ps,
  });

  const isLoading = profileLoading || invLoading;
  const isParentReadOnly = !!profile?.isParentReadOnly;
  const folders = inventory?.folders ?? [];
  const files = inventory?.files ?? [];

  return (
    <DomainTabShell
      title="내 인벤토리"
      description="제출한 파일과 선생님이 공유한 파일을 확인할 수 있습니다."
      tabs={TABS}
      activeTab={tab}
      onTabChange={setTab}
    >
      {isLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="stu-skel" style={{ height: 52, borderRadius: "var(--stu-radius)" }} />
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
