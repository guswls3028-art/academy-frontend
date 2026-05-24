import { Badge, type BadgeTone } from "@/shared/ui/ds";
import {
  VIDEO_STATUS_LABEL,
  VIDEO_STATUS_TONE,
  type VideoStatus,
} from "@/shared/api/contracts/videos";

interface VideoStatusBadgeProps {
  status?: VideoStatus;
}

export default function VideoStatusBadge({ status }: VideoStatusBadgeProps) {
  if (!status) return null;
  return (
    <Badge variant="solid" tone={VIDEO_STATUS_TONE[status] as BadgeTone}>
      {VIDEO_STATUS_LABEL[status]}
    </Badge>
  );
}
