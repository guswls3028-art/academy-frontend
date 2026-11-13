import api from "@/shared/api/axios";

interface VideoDownloadLink {
  download_url: string;
  filename: string;
  expires_in: number;
}

type VideoPlaybackExportState = "not_requested" | "preparing" | "ready" | "failed";

interface VideoPlaybackExportResult extends Partial<VideoDownloadLink> {
  state: VideoPlaybackExportState;
}

export async function requestVideoSourceDownload(videoId: number, signal: AbortSignal) {
  const { data } = await api.post<VideoDownloadLink>(
    `/media/videos/${videoId}/source-download/`,
    undefined,
    { signal },
  );
  return data;
}

export async function fetchVideoPlaybackExport(videoId: number, signal: AbortSignal) {
  const { data } = await api.get<VideoPlaybackExportResult>(`/media/videos/${videoId}/playback-export/`, { signal });
  return data;
}

export async function requestVideoPlaybackExport(videoId: number, signal: AbortSignal) {
  const { data } = await api.post<VideoPlaybackExportResult>(`/media/videos/${videoId}/playback-export/`, undefined, { signal });
  return data;
}
