// PATH: src/app_admin/domains/videos/ui/VideoStatusBadge.tsx
import { Badge, type BadgeTone } from "@/shared/ui/ds";

import type { VideoStatus } from "../api/videos.api";
import { VIDEO_STATUS_LABEL, VIDEO_STATUS_TONE } from "../utils/videoStatus";

interface Props {
  status?: VideoStatus;
}

export default function VideoStatusBadge({ status }: Props) {
  if (!status) return null;
  return (
    <Badge variant="solid" tone={VIDEO_STATUS_TONE[status] as BadgeTone}>
      {VIDEO_STATUS_LABEL[status]}
    </Badge>
  );
}
