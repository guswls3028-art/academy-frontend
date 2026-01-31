// PATH: src/features/videos/audit/pages/VideoAuditPage.tsx

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchPlaybackSessions, fetchPlaybackEvents } from "../api/playbackAudit";
import PlaybackSessionTable from "../components/PlaybackSessionTable";
import PlaybackEventTimeline from "../components/PlaybackEventTimeline";

export default function VideoAuditPage({ videoId }: { videoId: number }) {
  const [selectedSession, setSelectedSession] = useState<string | null>(null);

  const { data: sessions } = useQuery({
    queryKey: ["audit-sessions", videoId],
    queryFn: () => fetchPlaybackSessions(videoId),
    enabled: !!videoId,
    staleTime: 5000,
    retry: 1,
  });

  const { data: events } = useQuery({
    queryKey: ["audit-events", selectedSession],
    queryFn: () => fetchPlaybackEvents(selectedSession!),
    enabled: !!selectedSession,
    staleTime: 3000,
    retry: 1,
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        {/* SESSION LIST */}
        <section className="bg-[var(--bg-surface)] rounded-xl px-5 py-4 space-y-3">
          <div className="text-sm font-semibold text-[var(--text-primary)]">
            재생 세션
          </div>

          <PlaybackSessionTable
            sessions={sessions?.results ?? sessions ?? []}
            selectedSessionId={selectedSession ? Number(selectedSession) : null}
            onSelect={(id) => setSelectedSession(String(id))}
          />
        </section>

        {/* EVENT TIMELINE */}
        <section className="bg-[var(--bg-surface)] rounded-xl px-5 py-4 space-y-3">
          <div className="text-sm font-semibold text-[var(--text-primary)]">
            이벤트 타임라인
          </div>

          {selectedSession ? (
            <PlaybackEventTimeline events={events?.results ?? events ?? []} />
          ) : (
            <div className="text-sm text-[var(--text-muted)]">
              세션을 선택하세요.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
