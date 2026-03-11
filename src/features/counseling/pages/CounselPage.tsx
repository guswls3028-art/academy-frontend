// PATH: src/features/counseling/pages/CounselPage.tsx
// 기존 상담 페이지 → 커뮤니티 상담 신청 탭으로 리다이렉트
import { Navigate } from "react-router-dom";

export default function CounselPage() {
  return <Navigate to="/admin/community/counsel" replace />;
}
