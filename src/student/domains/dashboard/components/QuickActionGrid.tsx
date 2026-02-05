// PATH: src/student/domains/dashboard/components/QuickActionGrid.tsx

import { Link } from "react-router-dom";

type Item = {
  label: string;
  to: string;
};

const items: Item[] = [
  { label: "시험 · 성적", to: "/student/exams" },
  { label: "자료실", to: "/student/materials" },
  { label: "과제 제출", to: "/student/assignments" },
  { label: "성적 관리", to: "/student/grades" },
];

export default function QuickActionGrid() {
  return (
    <div className="stu-card">
      <div style={{ fontWeight: 900, marginBottom: 10 }}>바로가기</div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
        }}
      >
        {items.map((it) => (
          <Link key={it.to} to={it.to} className="stu-quick-btn">
            {it.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
