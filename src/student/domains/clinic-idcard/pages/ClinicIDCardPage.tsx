// PATH: src/student/domains/clinic-idcard/pages/ClinicIDCardPage.tsx

import { useEffect, useState } from "react";

type Result = "SUCCESS" | "FAIL";

type History = {
  index: number;
  result: Result;
};

export default function ClinicIDCardPage() {
  const [now, setNow] = useState(new Date());

  // ⏱ 실시간 시간 (움직임 = 사기 방지)
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ✅ MOCK 데이터 (현장 예시용)
  const studentName = "홍길동";
  const histories: History[] = [
    { index: 1, result: "SUCCESS" },
    { index: 2, result: "SUCCESS" },
    { index: 3, result: "FAIL" },
    { index: 4, result: "SUCCESS" },
  ];

  const hasFail = histories.some((h) => h.result === "FAIL");

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: 40,
      }}
    >
      {/* ⏰ 실시간 정보 */}
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 18, opacity: 0.8 }}>
          {now.toLocaleDateString()}
        </div>
        <div
          style={{
            fontSize: 32,
            fontWeight: 900,
            letterSpacing: 1,
            marginTop: 4,
          }}
        >
          {now.toLocaleTimeString()}
        </div>
      </div>

      {/* 👤 학생 이름 */}
      <div
        style={{
          fontSize: 36,
          fontWeight: 900,
          marginBottom: 20,
        }}
      >
        {studentName}
      </div>

      {/* ✅ 합/불 메인 판정 */}
      <div
        style={{
          width: "90%",
          maxWidth: 420,
          padding: "28px 20px",
          borderRadius: 20,
          textAlign: "center",
          fontSize: 40,
          fontWeight: 900,
          marginBottom: 28,
          background: hasFail
            ? "linear-gradient(135deg, #ff3b3b, #b40000)"
            : "linear-gradient(135deg, #00ff9c, #00b36b)",
          color: "#000",
          animation: "pulse 1.2s infinite",
        }}
      >
        {hasFail ? "❌ 불합격" : "✅ 합격"}
      </div>

      {/* 📊 차시 히스토리 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
          width: "90%",
          maxWidth: 420,
        }}
      >
        {histories.map((h) => (
          <div
            key={h.index}
            style={{
              padding: "16px 0",
              borderRadius: 14,
              textAlign: "center",
              fontWeight: 900,
              fontSize: 16,
              background:
                h.result === "SUCCESS"
                  ? "#0aff9d"
                  : "#ff2e2e",
              color: "#000",
            }}
          >
            {h.index}차
            <div style={{ marginTop: 6 }}>
              {h.result === "SUCCESS" ? "통과" : "실패"}
            </div>
          </div>
        ))}
      </div>

      {/* ⚠️ 경고 문구 */}
      {hasFail && (
        <div
          style={{
            marginTop: 28,
            color: "#ff5555",
            fontSize: 18,
            fontWeight: 900,
            textAlign: "center",
          }}
        >
          ❗ 클리닉 대상자 — 즉시 조치 필요
        </div>
      )}

      {/* 애니메이션 정의 */}
      <style>
        {`
          @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.03); }
            100% { transform: scale(1); }
          }
        `}
      </style>
    </div>
  );
}
