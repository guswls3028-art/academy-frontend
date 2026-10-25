import GuideCatalog from "@/shared/ui/guide/GuideCatalog";
import FeatureGuideReader from "@/shared/ui/guide/FeatureGuideReader";
import { TEACHER_WORKFLOWS } from "../data/teacherWorkflows";

export default function TeacherGuidePage() {
  return <><FeatureGuideReader /><GuideCatalog scope="teacher" articles={TEACHER_WORKFLOWS} title="현장 업무를 한 흐름으로"
    description="오늘 수업 확인부터 학생·출결·평가·소통과 마감까지 따라갑니다. 대량 작업과 자료 제작은 기능 찾기에서 전체 업무 화면으로 이어갈 수 있습니다." /></>;
}
