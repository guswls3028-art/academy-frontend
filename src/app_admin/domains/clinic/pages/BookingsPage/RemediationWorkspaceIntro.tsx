import { ArrowRight } from "lucide-react";
import { Link } from "react-router";

type RemediationWorkspaceIntroProps = {
  totalStudents: number;
  totalItems: number;
  showCount: boolean;
};

function RemediationWorkspaceIntro({
  totalStudents,
  totalItems,
  showCount,
}: RemediationWorkspaceIntroProps) {
  return (
    <div className="clinic-hub__intro">
      <div>
        <span className="clinic-hub__intro-eyebrow">전체 누적</span>
        <h2>전체 미통과 정리</h2>
        <p>날짜와 상관없이 아직 해결되지 않은 시험·과제입니다.</p>
      </div>
      <div className="clinic-hub__intro-actions">
        {showCount && (
          <span className="clinic-hub__intro-count">{totalStudents}명 · {totalItems}건</span>
        )}
        <Link className="clinic-hub__today-link" to="/workspace/clinic/operations?scope=day">
          오늘 클리닉 학생 보기
          <ArrowRight size={14} aria-hidden />
        </Link>
      </div>
    </div>
  );
}

export default RemediationWorkspaceIntro;
