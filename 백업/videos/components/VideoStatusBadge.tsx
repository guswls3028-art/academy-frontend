import { VideoStatus } from "@/features/lectures/api/videos";
import {
  VIDEO_STATUS_LABEL,
  VIDEO_STATUS_STYLE,
} from "../utils/videoStatus";

interface Props {
  status?: VideoStatus;
}

export default function VideoStatusBadge({ status }: Props) {
  if (!status) return null;

  return (
    <span
      className={`rounded px-2 py-0.5 text-xs font-medium ${VIDEO_STATUS_STYLE[status]}`}
    >
      {VIDEO_STATUS_LABEL[status]}
    </span>
  );
}
