import { Navigate, useLocation } from "react-router";
import { DomainLayout } from "@/shared/ui/layout";
import GuideCatalog from "@/shared/ui/guide/GuideCatalog";
import { useAvailableAdminNavigation } from "@admin/layout/useAvailableAdminNavigation";
import { ADMIN_WORKFLOWS } from "../data/adminWorkflows";

export default function AdminGuidePage() {
  const location = useLocation();
  const navigation = useAvailableAdminNavigation();
  const availablePaths = navigation.flatMap((group) => group.items.map((item) => item.to));
  const articles = ADMIN_WORKFLOWS.filter((article) =>
    availablePaths.some((path) => article.path === path || article.path.startsWith(`${path}/`)),
  );
  const params = new URLSearchParams(location.search);
  if (location.hash === "#exam-score-guide" && !params.has("topic")) {
    params.set("topic", "create-exam");
    return <Navigate replace to={{ pathname: location.pathname, search: `?${params.toString()}` }} />;
  }
  return (
    <DomainLayout title="공식 사용 가이드" description="학생 등록부터 수업 운영과 결과 확인까지, 실제 업무 순서로 따라갑니다.">
      <GuideCatalog scope="admin" articles={articles} title="학원 운영, 처음부터 끝까지"
        description="학생과 강의를 준비하고, 매 수업을 운영한 뒤 학습 결과와 안내를 확인하세요. 각 기능의 준비사항·실행 순서·완료 기준·문제 해결을 모았습니다. 권한에 따라 이용 가능한 메뉴가 달라집니다." />
    </DomainLayout>
  );
}
