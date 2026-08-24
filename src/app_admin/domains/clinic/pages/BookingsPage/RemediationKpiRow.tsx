import { AlertTriangle, BookOpen, Clock, Users } from "lucide-react";

type Props = {
  unavailable: boolean;
  loading: boolean;
  totalStudents: number;
  examItems: number;
  homeworkItems: number;
  missingItems: number;
};

export default function RemediationKpiRow({
  unavailable,
  loading,
  totalStudents,
  examItems,
  homeworkItems,
  missingItems,
}: Props) {
  const display = (value: number) => unavailable ? "—" : value;
  return (
    <div className="clinic-hub__kpi-row" aria-busy={loading || undefined}>
      <div className="clinic-hub__kpi clinic-hub__kpi--primary">
        <Users size={16} />
        <div>
          <span className="clinic-hub__kpi-value">{display(totalStudents)}</span>
          <span className="clinic-hub__kpi-label">진행중 학생</span>
        </div>
      </div>
      <div className="clinic-hub__kpi clinic-hub__kpi--danger">
        <AlertTriangle size={16} />
        <div>
          <span className="clinic-hub__kpi-value">{display(examItems)}</span>
          <span className="clinic-hub__kpi-label">시험 불합격</span>
        </div>
      </div>
      <div className="clinic-hub__kpi">
        <BookOpen size={16} />
        <div>
          <span className="clinic-hub__kpi-value">{display(homeworkItems)}</span>
          <span className="clinic-hub__kpi-label">과제 미통과</span>
        </div>
      </div>
      <div className="clinic-hub__kpi clinic-hub__kpi--warning">
        <Clock size={16} />
        <div>
          <span className="clinic-hub__kpi-value">{display(missingItems)}</span>
          <span className="clinic-hub__kpi-label">미응시·미제출</span>
        </div>
      </div>
    </div>
  );
}
