// PATH: src/app_admin/domains/auth/pages/TenantRequiredPage.tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useProgram } from "@/shared/program";

export default function TenantRequiredPage() {
  const { error, refetch } = useProgram();
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await refetch();
      // refetch 성공 시 program이 설정되어 RootRedirect가 정상 라우팅
      window.location.href = "/";
    } catch {
      // refetch 실패 — 페이지 유지
    } finally {
      setRetrying(false);
    }
  };

  // 서버 에러로 인한 진입인 경우
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b0d12]">
        <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-xl text-center">
          <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-amber-500" aria-hidden />
          <h1 className="text-xl font-black mb-3">서버에 연결할 수 없습니다</h1>
          <p className="text-sm text-gray-600 mb-6 leading-relaxed">
            일시적인 문제일 수 있습니다. 잠시 후 다시 시도해 주세요.
          </p>

          <button
            type="button"
            onClick={handleRetry}
            disabled={retrying}
            className={`inline-flex items-center justify-center rounded-lg px-6 py-3 text-white font-semibold ${
              retrying ? "cursor-not-allowed bg-slate-400" : "cursor-pointer bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {retrying ? "연결 중…" : "다시 시도"}
          </button>

          <p className="text-xs text-gray-400 mt-4">
            문제가 계속되면 잠시 후 다시 시도해 주세요.
          </p>
        </div>
      </div>
    );
  }

  // 기존: 업데이트/테넌트 미식별 시
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0b0d12]">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-xl text-center">
        <RefreshCw className="mx-auto mb-3 h-10 w-10 text-blue-600" aria-hidden />
        <h1 className="text-xl font-black mb-3">업데이트가 적용되었습니다</h1>
        <p className="text-sm text-gray-600 mb-2 leading-relaxed">
          서비스 개선을 위한 대규모 업데이트가 반영되었습니다.
        </p>
        <p className="text-sm text-gray-600 mb-6 leading-relaxed">
          원활한 이용을 위해 <strong>다시 로그인</strong>해 주세요.
        </p>

        <Link
          to="/login"
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-6 py-3 text-white font-semibold hover:bg-blue-700"
        >
          다시 로그인하기
        </Link>

        <p className="text-xs text-gray-400 mt-4">
          문제가 계속되면 페이지를 새로고침하거나 잠시 후 다시 시도해 주세요.
        </p>
      </div>
    </div>
  );
}
