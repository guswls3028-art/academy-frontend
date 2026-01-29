// PATH: src/shared/ui/attendance/AttendanceIcon.tsx

import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  LogOut,
  Stethoscope,
  Video,
  HelpCircle,
} from "lucide-react";

import type { AttendanceStatus } from "./attendanceTokens";

export function AttendanceIcon({
  status,
  className = "w-4 h-4",
}: {
  status: AttendanceStatus;
  className?: string;
}) {
  switch (status) {
    case "PRESENT":
      return <CheckCircle className={className} />;
    case "ABSENT":
      return <XCircle className={className} />;
    case "LATE":
      return <Clock className={className} />;
    case "EARLY_LEAVE":
      return <LogOut className={className} />;
    case "EXCUSED":
      return <AlertTriangle className={className} />;
    case "SICK":
      return <Stethoscope className={className} />;
    case "ONLINE":
      return <Video className={className} />;
    default:
      return <HelpCircle className={className} />;
  }
}
