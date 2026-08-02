/**
 * HomeworkSetupPanel
 * - setup 탭 화면
 * - 과제별 커트라인 + 과제 대상자 요약
 */

import HomeworkPolicyPanel from "./setup/HomeworkPolicyPanel";
import HomeworkMaxScorePanel from "./setup/HomeworkMaxScorePanel";
import HomeworkEnrollmentPanel from "./setup/HomeworkEnrollmentPanel";

export default function HomeworkSetupPanel({
  homeworkId,
}: {
  homeworkId: number;
}) {
  return (
    <div className="space-y-6">
      <HomeworkMaxScorePanel homeworkId={homeworkId} />
      <HomeworkPolicyPanel homeworkId={homeworkId} />
      <HomeworkEnrollmentPanel homeworkId={homeworkId} />
    </div>
  );
}
