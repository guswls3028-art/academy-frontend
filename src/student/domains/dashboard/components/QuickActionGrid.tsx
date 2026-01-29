// src/student/domains/dashboard/components/QuickActionGrid.tsx
/**
 * ✅ QuickActionGrid
 * - 이미지의 "바로가기 4개" 구현
 * - 링크만 제공 (판단/계산 ❌)
 */

import { Link } from "react-router-dom";

export default function QuickActionGrid() {
  const items = [
    { label: "과제 제출", to: "/student/assignments" }, // 추후 도메인 연결
    { label: "학습자료", to: "/student/materials" }, // 추후 도메인 연결
    { label: "시험 · 평가", to: "/student/exams" },
    { label: "성적 관리", to: "/student/grades" },
  ];

  return (
    <div
      style={{
        border: "1px solid #eee",
        borderRadius: 12,
        background: "#fff",
        padding: 14,
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 10 }}>바로가기</div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
        }}
      >
        {items.map((it) => (
          <Link
            key={it.to}
            to={it.to}
            style={{
              textDecoration: "none",
              border: "1px solid #eee",
              borderRadius: 10,
              padding: "14px 12px",
              fontWeight: 700,
              color: "#111",
              background: "#fafafa",
            }}
          >
            {it.label}
          </Link>
        ))}
      </div>

      <div style={{ marginTop: 10, fontSize: 12, color: "#777" }}>
        ※ 과제/자료는 추후 도메인 연결 예정 (라우팅 자리만 확보)
      </div>
    </div>
  );
}
