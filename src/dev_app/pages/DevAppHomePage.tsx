// PATH: src/dev_app/pages/DevAppHomePage.tsx
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import ToggleSwitch from "@/features/videos/ui/ToggleSwitch";
import AdminToast from "@/dev_app/components/AdminToast";
import { getMaintenanceMode, setMaintenanceMode, type MaintenanceModeDto } from "@/dev_app/api/maintenance";

export default function DevAppHomePage() {
  const [mode, setMode] = useState<MaintenanceModeDto | null>(null);
  const [loadingMode, setLoadingMode] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [toast, setToast] = useState<{ message: string; kind: "success" | "error" } | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoadingMode(true);
    getMaintenanceMode()
      .then((dto) => {
        if (mounted) setMode(dto);
      })
      .catch(() => {
        if (mounted) setMode(null);
      })
      .finally(() => {
        if (mounted) setLoadingMode(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  async function onToggleMaintenance(next: boolean) {
    if (toggling) return;
    setToggling(true);
    setToast(null);
    try {
      const dto = await setMaintenanceMode(next);
      setMode(dto);
      setToast({ message: next ? "점검 모드를 활성화했습니다." : "점검 모드를 해제했습니다.", kind: "success" });
    } catch {
      setToast({ message: "점검 모드 변경에 실패했습니다.", kind: "error" });
    } finally {
      setToggling(false);
    }
  }

  return (
    <div>
      <AdminToast
        message={toast?.message ?? ""}
        kind={toast?.kind ?? "success"}
        visible={!!toast}
        onClose={() => setToast(null)}
      />

      <h1 className="text-xl font-semibold text-slate-800 mb-2">
        Developer App
      </h1>
      <p className="text-slate-600 mb-6">
        Tenant 1 (hakwonplus) 관리자용. 테넌트별 로고·로그인 화면·이미지 설정.
      </p>

      <div className="mb-6 p-4 rounded-xl border-2 border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 mb-1">점검 모드 (공용 안내 화면)</h2>
            <p className="text-sm text-slate-600">
              모든 테넌트에 유지보수 오버레이를 노출합니다.
            </p>
          </div>

          {loadingMode ? (
            <div className="h-6 w-11 rounded-full bg-slate-100 animate-pulse" aria-label="로딩 중" />
          ) : (
            <ToggleSwitch
              checked={Boolean(mode?.enabledForAll)}
              onChange={onToggleMaintenance}
              disabled={toggling}
            />
          )}
        </div>

        {!loadingMode && mode && (
          <div className="mt-2 text-xs text-slate-500">
            적용 상태: {mode.enabledCount}/{mode.total} 테넌트
          </div>
        )}
      </div>

      <div className="mb-6 p-4 rounded-xl border-2 border-emerald-200 bg-emerald-50/50">
        <h2 className="text-sm font-semibold text-emerald-800 mb-2">선생용 앱 (운영 콘솔)</h2>
        <p className="text-sm text-emerald-700 mb-3">
          강의, 학생, 시험, 클리닉 등 실제 기능이 있는 운영 콘솔로 이동합니다.
        </p>
        <Link
          to="/admin"
          className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 text-white font-medium text-sm hover:bg-emerald-700 active:bg-emerald-800"
        >
          운영 콘솔 열기 →
        </Link>
      </div>

      <ul className="list-disc list-inside space-y-2 text-slate-700">
        <li>
          <Link to="/dev/branding" className="text-blue-600 hover:underline">
            Tenant branding
          </Link>
          — 로고, 로그인 타이틀, 학생용 이미지 등 (R2 연동 예정)
        </li>
      </ul>
    </div>
  );
}
