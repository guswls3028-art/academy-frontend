/**
 * 클리닉 인증(패스카드) — 실무: 조교 1명이 100명가량 빠르게 시각 확인
 * - 깡블랙 배경 + 눈에 띄는 색/애니메이션
 * - 실시간 시계(초 단위 갱신)로 위조·스크린샷 즉시 판별
 */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchClinicIdcard } from "../api/idcard";
import "../styles/idcard.css";

/** 실시간 시각 문자열 (초 단위) — 위조/스크린샷 시 초가 멈춰 보이므로 판별용 */
function useLiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function formatLiveTime(d: Date): string {
  const h = d.getHours();
  const ampm = h < 12 ? "오전" : "오후";
  const h12 = h % 12 || 12;
  const m = d.getMinutes();
  const s = d.getSeconds();
  return `${ampm} ${h12}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatLiveDate(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const weekdays = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
  const w = weekdays[d.getDay()];
  return `${y}년 ${m}월 ${day}일 ${w}`;
}

export default function ClinicIDCardPage() {
  const liveNow = useLiveClock();
  const { data, isLoading, error } = useQuery({
    queryKey: ["clinic-idcard"],
    queryFn: fetchClinicIdcard,
  });

  if (isLoading) {
    return (
      <div className="idcard-page idcard-page--black">
        <div className="idcard-page__loading">불러오는 중…</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="idcard-page idcard-page--black">
        <div className="idcard-page__error">
          {error instanceof Error ? error.message : "데이터를 불러올 수 없습니다."}
        </div>
      </div>
    );
  }

  const isClinicTarget = data.current_result === "FAIL";

  return (
    <div className="idcard-page idcard-page--black">
      {/* LIVE 뱃지 + 실시간 시계 (초 단위) — 위조 판별용 */}
      <div className="idcard-page__live-badge">
        <span className="idcard-page__live-dot" aria-hidden />
        <span>LIVE</span>
      </div>

      <div className="idcard-page__label">조회 일시</div>
      <div className="idcard-page__date">{formatLiveDate(liveNow)}</div>
      <div className="idcard-page__time" aria-live="polite">
        {formatLiveTime(liveNow)}
      </div>

      {/* 학생 이름 */}
      <div className="idcard-page__name">{data.student_name || "-"}</div>

      {/* 패스카드: 클리닉 대상(빨강) / 합격(초록) — 애니메이션으로 생동감 */}
      <div
        className={`idcard-page__pass-card ${isClinicTarget ? "idcard-page__pass-card--clinic" : "idcard-page__pass-card--pass"}`}
      >
        <div className="idcard-page__pass-card-title">
          {isClinicTarget ? "클리닉 대상" : "클리닉 대상 아님"}
        </div>
        <div className="idcard-page__pass-card-sub">
          {isClinicTarget ? "해당 차시 이수·합격 후 해제됩니다." : "합격"}
        </div>
      </div>

      {/* 차시별 이력 (1~n) — 읽기 전용 */}
      <div className="idcard-page__history-label">차시별 이력 (합격/클리닉 대상)</div>
      <div className="idcard-page__history-grid">
        {data.histories.length === 0 ? (
          <div className="idcard-page__history-empty">차시 이력이 없습니다.</div>
        ) : (
          data.histories.map((h) => (
            <div
              key={h.session_order}
              className={`idcard-page__history-item ${h.clinic_required ? "idcard-page__history-item--clinic" : "idcard-page__history-item--pass"}`}
            >
              {h.session_order}차시
              <div className="idcard-page__history-item-sub">
                {h.clinic_required ? "클리닉 대상" : "합격"}
              </div>
            </div>
          ))
        )}
      </div>

      {isClinicTarget && (
        <div className="idcard-page__clinic-notice">
          클리닉 대상 — 선생님 안내에 따라 참여해 주세요.
        </div>
      )}
    </div>
  );
}
