// PATH: src/features/auth/pages/login/LoginEntry.tsx
import { Navigate } from "react-router-dom";
import { useProgram } from "@/shared/program";

export default function LoginEntry() {
  const { program, isLoading } = useProgram();

  if (isLoading) return null;

  if (!program) {
    return <Navigate to="/error/tenant-required" replace />;
  }

  const hasCustomLogin =
    !!program.ui_config?.login_title ||
    !!program.ui_config?.logo_url;

  if (hasCustomLogin) {
    return <Navigate to="/login/custom" replace />;
  }

  return <Navigate to="/login/hakwonplus" replace />;
}
