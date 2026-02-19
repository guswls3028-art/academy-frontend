/**
 * 클리닉 인증(패스카드) — 실무: 조교 1명이 100명가량 빠르게 시각 확인
 * - 깡블랙 배경 + 눈에 띄는 색/애니메이션
 * - 실시간 시계(초 단위 갱신)로 위조·스크린샷 즉시 판별
 */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchClinicIdcard } from "../api/idcard";
import "../styles/idcard.css";

function formatDisplayDate(isoDate: string): string {
  if (!isoDate) return "-";
  const parts = isoDate.split("T")[0].split("-");
  if (parts.length !== 3) return isoDate;
  const [y, m, d] = parts.map(Number);
  const weekdays = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
  const months = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
  try {
    const date = new Date(y, m - 1, d);
    const w = date.getDay();
    return `${y}년 ${months[m - 1]} ${d}일 ${weekdays[w]}`;
  } catch {
    return isoDate;
  }
}

export default function ClinicIDCardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["clinic-idcard"],
    queryFn: fetchClinicIdcard,
  });

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          background: "#0f1419",
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div style={{ fontSize: 18, color: "var(--stu-text-muted)" }}>불러오는 중…</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          background: "#0f1419",
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div style={{ fontSize: 16, color: "#f87171" }}>
          {error instanceof Error ? error.message : "데이터를 불러올 수 없습니다."}
        </div>
      </div>
    );
  }

  const isClinicTarget = data.current_result === "FAIL";

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#0f1419",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "var(--stu-space-6) var(--stu-space-4)",
        paddingTop: "max(var(--stu-safe-top), 24px)",
      }}
    >
      {/* 서버 기준 오늘 날짜 — 위조 방지용으로 크게 */}
      <div
        style={{
          fontSize: "clamp(1.25rem, 5vw, 1.75rem)",
          fontWeight: 800,
          letterSpacing: "-0.02em",
          marginBottom: 8,
          color: "#94a3b8",
        }}
      >
        조회 일시
      </div>
      <div
        style={{
          fontSize: "clamp(1.5rem, 6vw, 2.25rem)",
          fontWeight: 900,
          letterSpacing: "-0.02em",
          marginBottom: 24,
          color: "#e2e8f0",
        }}
      >
        {formatDisplayDate(data.server_date)}
      </div>
      <div
        style={{
          fontSize: "clamp(1rem, 4vw, 1.25rem)",
          fontWeight: 700,
          color: "#64748b",
          marginBottom: 32,
        }}
      >
        {data.server_datetime ? new Date(data.server_datetime).toLocaleTimeString("ko-KR") : ""}
      </div>

      {/* 학생 이름 */}
      <div
        style={{
          fontSize: "clamp(1.25rem, 5vw, 1.5rem)",
          fontWeight: 800,
          marginBottom: 28,
        }}
      >
        {data.student_name || "-"}
      </div>

      {/* 중앙: n차시 합불여부 — 클리닉 대상(빨강) / 합격(초록) */}
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          padding: "28px 20px",
          borderRadius: 16,
          textAlign: "center",
          marginBottom: 32,
          background: isClinicTarget
            ? "linear-gradient(135deg, #b91c1c 0%, #7f1d1d 100%)"
            : "linear-gradient(135deg, #15803d 0%, #14532d 100%)",
          color: "#fff",
          boxShadow: isClinicTarget ? "0 8px 24px rgba(185,28,28,0.35)" : "0 8px 24px rgba(21,128,61,0.35)",
        }}
      >
        <div style={{ fontSize: "clamp(1.5rem, 6vw, 2.25rem)", fontWeight: 900 }}>
          {isClinicTarget ? "클리닉 대상" : "클리닉 대상 아님"}
        </div>
        <div style={{ fontSize: "clamp(0.9rem, 3.5vw, 1.1rem)", fontWeight: 700, marginTop: 8, opacity: 0.95 }}>
          {isClinicTarget ? "해당 차시 이수·합격 후 해제됩니다." : "합격"}
        </div>
      </div>

      {/* 차시별 이력 (1~n) — 읽기 전용, 클릭 불가 */}
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: "#64748b",
          marginBottom: 12,
          alignSelf: "flex-start",
          maxWidth: 420,
          width: "100%",
        }}
      >
        차시별 이력 (합격/클리닉 대상)
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))",
          gap: 10,
          width: "100%",
          maxWidth: 420,
        }}
      >
        {data.histories.length === 0 ? (
          <div style={{ gridColumn: "1 / -1", textAlign: "center", color: "#64748b", fontSize: 14 }}>
            차시 이력이 없습니다.
          </div>
        ) : (
          data.histories.map((h) => (
            <div
              key={h.session_order}
              style={{
                padding: "14px 8px",
                borderRadius: 12,
                textAlign: "center",
                fontWeight: 800,
                fontSize: 14,
                background: h.clinic_required ? "#7f1d1d" : "#14532d",
                color: "#fff",
                pointerEvents: "none",
                userSelect: "none",
              }}
            >
              {h.session_order}차시
              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.95 }}>
                {h.clinic_required ? "클리닉 대상" : "합격"}
              </div>
            </div>
          ))
        )}
      </div>

      {isClinicTarget && (
        <div
          style={{
            marginTop: 28,
            color: "#fca5a5",
            fontSize: 15,
            fontWeight: 700,
            textAlign: "center",
          }}
        >
          클리닉 대상 — 선생님 안내에 따라 참여해 주세요.
        </div>
      )}
    </div>
  );
}
