/**
 * 영상 페이지 — DomainTabShell 기반 (홈 | 통계)
 * 홈: 강의 코스 그리드
 * 통계: 시청 분석 (완료율, 시청시간, 강좌별 진도)
 */
import { useState, useEffect } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import DomainTabShell from "@student/shared/ui/pages/DomainTabShell";
import { IconPlay } from "@student/shared/ui/icons/Icons";
import { fetchVideoMe } from "../api/video.api";
import VideoHomeTab from "../components/VideoHomeTab";
import VideoStatsTab from "../components/VideoStatsTab";
import { studentVideoQueryKeys } from "../queryKeys";

const TABS = [
  { key: "home", label: "강의" },
  { key: "stats", label: "통계" },
];

export default function VideoHomePage() {
  const [tab, setTab] = useState("home");

  // Preload hls.js chunk for faster video playback start
  useEffect(() => {
    import("hls.js").catch(() => {});
  }, []);

  const { data: videoMe, isLoading } = useQuery({
    queryKey: studentVideoQueryKeys.me,
    queryFn: fetchVideoMe,
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
  });

  return (
    <div className="video-page-content">
      <DomainTabShell
        title="영상"
        variant="plain"
        icon={<IconPlay aria-hidden="true" />}
        tabs={TABS}
        activeTab={tab}
        onTabChange={setTab}
      >
        {isLoading && videoMe == null && (
          <div className="stu-skel-stack stu-skel-stack--loose">
            <div className="stu-skel stu-skel--xxl" />
            <div className="stu-skel stu-skel--xxl" />
          </div>
        )}

        {!isLoading && tab === "home" && (
          <VideoHomeTab
            lectures={videoMe?.lectures ?? []}
            publicData={videoMe?.public ?? null}
          />
        )}

        {tab === "stats" && <VideoStatsTab />}
      </DomainTabShell>
    </div>
  );
}
