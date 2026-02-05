// PATH: src/student/domains/clinic-idcard/pages/ClinicIDCardPage.tsx

import { useEffect, useState } from "react";

type Result = "SUCCESS" | "FAIL";

type History = {
  index: number;
  result: Result;
};

export default function ClinicIDCardPage() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const studentName = "홍길동";

  const histories: History[] = [
    { index: 1, result: "SUCCESS" },
    { index: 2, result: "SUCCESS" },
    { index: 3, result: "FAIL" },
    { index: 4, result: "SUCCESS" },
  ];

  const hasFail = histories.some((h) => h.result === "FAIL");

  const dateText = now.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: 32,
      }}
    >
      {/* 📅 날짜 (대형, 최상단) */}
      <div
        style={{
          fontSize: 30,
          fontWeight: 900,
          letterSpacing: "-0.5px",
          marginBottom: 25,
          color: "#b2e5e9ff",
          textShadow: "0 0 12px rgba(0,255,208,0.35)",
        }}
      >
        {dateText}
      </div>

      {/* ⏰ 시간 (움직임) */}
      <div
        style={{
          fontSize: 36,
          fontWeight: 900,
          letterSpacing: 1,
          marginBottom: 28,
        }}
      >
        {now.toLocaleTimeString()}
      </div>

      {/* 👤 학생 이름 */}
      <div
        style={{
          fontSize: 38,
          fontWeight: 900,
          marginBottom: 22,
        }}
      >
        {studentName}
      </div>

      {/* ✅ 합/불 메인 */}
      <div
        style={{
          width: "90%",
          maxWidth: 420,
          padding: "30px 20px",
          borderRadius: 22,
          textAlign: "center",
          fontSize: 42,
          fontWeight: 900,
          marginBottom: 30,
          background: hasFail
            ? "linear-gradient(135deg, #ff3b3b, #b40000)"
            : "linear-gradient(135deg, #00ff9c, #00b36b)",
          color: "#000",
          animation: "pulse 1.2s infinite",
        }}
      >
        {hasFail ? "❌ 클리닉 대상자" : "✅ 합격"}
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
                h.result === "SUCCESS" ? "#0aff9d" : "#ff2e2e",
              color: "#000",
            }}
          >
            {h.index}차시
            <div style={{ marginTop: 6 }}>
              {h.result === "SUCCESS" ? "합격" : "불합격"}
            </div>
          </div>
        ))}
      </div>

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

      <style>
        {`
          @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.035); }
            100% { transform: scale(1); }
          }
        `}
      </style>
    </div>
  );
}
