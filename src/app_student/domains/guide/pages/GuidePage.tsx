import GuideCatalog from "@/shared/ui/guide/GuideCatalog";
import { useFeesEnabled } from "@/shared/hooks/useFeesEnabled";
import { STUDENT_WORKFLOWS } from "../data/studentWorkflows";

export default function GuidePage() {
  const feesEnabled = useFeesEnabled();
  const articles = STUDENT_WORKFLOWS.filter((article) => article.id !== "fees" || feesEnabled);
  return <GuideCatalog scope="student" articles={articles} title="수업부터 제출과 결과까지"
    description="학생과 학부모가 함께 보는 이용 안내예요. 학부모는 먼저 자녀를 확인하고, 화면에 표시되는 이용 권한에 따라 진행해 주세요. 준비부터 제출·예약 결과 확인까지 차례로 따라갈 수 있어요." />;
}