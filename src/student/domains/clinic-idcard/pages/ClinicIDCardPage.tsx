// PATH: src/student/domains/clinic-idcard/pages/ClinicIDCardPage.tsx

import { useEffect, useMemo, useState } from "react";

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

  /** ✅ 히스토리: 클릭으로 상태 변경 */
  const [histories, setHistories] = useState<History[]>([
    { index: 1, result: "SUCCESS" },
    { index: 2, result: "SUCCESS" },
    { index: 3, result: "FAIL" },
    { index: 4, result: "SUCCESS" },
  ]);

  /** ✅ 하나라도 FAIL이면 클리닉 대상자 */
  const hasFail = useMemo(
    () => histories.some((h) => h.result === "FAIL"),
    [histories]
  );

  const dateText = now.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  function toggleHistory(index: number) {
    setHistories((prev) =>
      prev.map((h) =>
        h.index === index
          ? {
              ...h,
              result: h.result === "SUCCESS" ? "FAIL" : "SUCCESS",
            }
          : h
      )
    );
  }

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
      {/* 📅 날짜 */}
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

      {/* ⏰ 시간 */}
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

      {/* ✅ 합 / ❌ 클리닉 */}
      <div
        key={hasFail ? "fail" : "success"} // 🔥 상태 바뀔 때 애니메이션 재실행
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
          animation: hasFail
            ? "failPulse 0.9s ease-in-out"
            : "successPop 0.6s ease-out",
        }}
      >
        {hasFail ? "❌ 클리닉 대상자" : "✅ 합격"}
      </div>

      {/* 📊 차시 히스토리 (클릭 가능) */}
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
            onClick={() => toggleHistory(h.index)}
            style={{
              padding: "16px 0",
              borderRadius: 14,
              textAlign: "center",
              fontWeight: 900,
              fontSize: 16,
              background:
                h.result === "SUCCESS" ? "#0aff9d" : "#ff2e2e",
              color: "#000",
              cursor: "pointer",
              userSelect: "none",
              transition: "transform 120ms ease",
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
          @keyframes failPulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
          }

          @keyframes successPop {
            0% { transform: scale(0.96); }
            70% { transform: scale(1.04); }
            100% { transform: scale(1); }
          }
        `}
      </style>
    </div>
  );
}
