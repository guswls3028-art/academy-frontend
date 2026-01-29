export default function VideoAuditPage({ videoId }: { videoId: number }) {
  const [selectedSession, setSelectedSession] = useState<string | null>(null);

  const { data: sessions } = useQuery({
    queryKey: ["audit-sessions", videoId],
    queryFn: () => fetchPlaybackSessions(videoId),
  });

  const { data: events } = useQuery({
    queryKey: ["audit-events", selectedSession],
    queryFn: () => fetchPlaybackEvents(selectedSession!),
    enabled: !!selectedSession,
  });

  return (
    <div className="grid grid-cols-2 gap-6">
      <PlaybackSessionTable
        sessions={sessions?.results ?? []}
        onSelect={setSelectedSession}
      />

      {selectedSession && (
        <PlaybackEventTimeline events={events?.results ?? []} />
      )}
    </div>
  );
}
