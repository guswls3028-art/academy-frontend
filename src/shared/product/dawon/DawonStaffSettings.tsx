import { useLocation } from "react-router";
import SettingsLayout from "@admin/domains/settings/SettingsLayout";
import { AcademyModeSection } from "@admin/domains/settings/pages/OrganizationSettingsPage";
import AppearancePage from "@admin/domains/settings/pages/AppearancePage";
import ProfileSettingsPage from "@admin/domains/settings/pages/ProfileSettingsPage";
import { dawonStaffPreviewRole } from "./staffPreview";

const allowedSections = ["profile", "organization", "appearance"] as const;

export default function DawonStaffSettings() {
  const { pathname } = useLocation();
  return <SettingsLayout allowedSections={allowedSections}>
    {pathname.endsWith("/organization") ? <AcademyModeSection/> : pathname.endsWith("/appearance") ? <AppearancePage /> : <ProfileSettingsPage
      readOnlyRole={dawonStaffPreviewRole() === "teacher" ? "선생님" : "관리자"}/>}
  </SettingsLayout>;
}
