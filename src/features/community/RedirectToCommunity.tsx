// PATH: src/features/community/RedirectToCommunity.tsx
// 강의 내 자료실/게시판에서 통합 콘솔로 리다이렉트

import { Navigate, useParams } from "react-router-dom";

export function RedirectToCommunityMaterials() {
  const { lectureId } = useParams<{ lectureId: string }>();
  const id = lectureId != null && Number.isFinite(Number(lectureId)) ? lectureId : "";
  if (!id) return <Navigate to="/admin/community/materials" replace />;
  return <Navigate to={`/admin/community/materials?scope=lecture&lectureId=${id}`} replace />;
}

export function RedirectToCommunityNotice() {
  const { lectureId } = useParams<{ lectureId: string }>();
  const id = lectureId != null && Number.isFinite(Number(lectureId)) ? lectureId : "";
  if (!id) return <Navigate to="/admin/community/admin?tab=notice" replace />;
  return <Navigate to={`/admin/community/admin?tab=notice&scope=lecture&lectureId=${id}`} replace />;
}
