/**
 * 영상 페이지 — DomainTabShell 기반 (홈 | 통계)
 * 홈: 강의 코스 그리드
 * 통계: 시청 분석 (완료율, 시청시간, 강좌별 진도)
 */
import { useState, useEffect } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import DomainTabShell from "@student/shared/ui/pages/DomainTabShell";
import { fetchVideoMe } from "../api/video.api";
import VideoHomeTab from "../components/VideoHomeTab";
import VideoStatsTab from "../components/VideoStatsTab";

const TABS = [
  { key: "home", label: "홈" },
  { key: "stats", label: "통계" },
];

export default function VideoHomePage() {
  const [tab, setTab] = useState("home");

  // Preload hls.js chunk for faster video playback start
  useEffect(() => {
    import("hls.js").catch(() => {});
  }, []);

  const { data: videoMe, isLoading } = useQuery({
    queryKey: ["student-video-me"],
    queryFn: fetchVideoMe,
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
  });

  return (
    <DomainTabShell title="영상" tabs={TABS} activeTab={tab} onTabChange={setTab}>
      {isLoading && videoMe == null && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="stu-skel" style={{ height: 200, borderRadius: "var(--stu-radius-lg)" }} />
          <div className="stu-skel" style={{ height: 200, borderRadius: "var(--stu-radius-lg)" }} />
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
  );
}
