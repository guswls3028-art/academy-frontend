// PATH: src/features/videos/ui/VideoStatusBadge.tsx

import type { VideoStatus } from "../api/videos";

import { VIDEO_STATUS_LABEL, VIDEO_STATUS_STYLE } from "../utils/videoStatus";

interface Props {
  status?: VideoStatus;
}

export default function VideoStatusBadge({ status }: Props) {
  if (!status) return null;

  return (
    <span className={`ds-status-badge ${VIDEO_STATUS_STYLE[status]}`}>
      {VIDEO_STATUS_LABEL[status]}
    </span>
  );
}
