import { CareDirectory } from "./DawonAdminDirectories";
import { dawonStaffPreviewRole } from "./staffPreview";

export default function DawonClinicRequests() {
  return <CareDirectory teacher={dawonStaffPreviewRole()==="teacher"} embedded/>;
}
