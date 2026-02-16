// PATH: src/admin_app/pages/AdminAppHomePage.tsx
import { Link } from "react-router-dom";

export default function AdminAppHomePage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-800 mb-2">
        Developer Admin
      </h1>
      <p className="text-slate-600 mb-6">
        Tenant 1 (hakwonplus) 관리자용. 테넌트별 로고·로그인 화면·이미지 설정.
      </p>

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
