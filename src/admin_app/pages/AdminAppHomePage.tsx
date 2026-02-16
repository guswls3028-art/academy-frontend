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
