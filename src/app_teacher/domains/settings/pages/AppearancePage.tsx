import { useNavigate } from "react-router";
import { BackButton } from "@teacher/shared/ui/Card";
import AppearanceSettings from "@/shared/theme/AppearanceSettings";
export default function AppearancePage() {
  const navigate = useNavigate();
  return <div className="flex flex-col gap-4 pb-4">
    <div className="flex items-center gap-2 py-1"><BackButton onClick={() => navigate(-1)} /><h1 className="text-lg font-semibold">테마</h1></div>
    <AppearanceSettings />
  </div>;
}
