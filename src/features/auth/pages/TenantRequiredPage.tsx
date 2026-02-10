// PATH: src/features/auth/pages/TenantRequiredPage.tsx
import { Link } from "react-router-dom";

export default function TenantRequiredPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0b0d12]">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h1 className="text-xl font-black mb-2">접근 불가</h1>
        <p className="text-sm font-semibold text-gray-700 mb-4">
          이 서비스는 학원(테넌트) 도메인을 통해서만 접근할 수 있습니다.
        </p>

        <div className="text-xs text-gray-500 mb-6">
          올바른 도메인으로 접속했는지 확인해주세요.
        </div>

        <Link
          to="/login"
          className="inline-flex items-center justify-center rounded bg-black px-4 py-2 text-white font-semibold"
        >
          로그인 페이지로 이동
        </Link>
      </div>
    </div>
  );
}
