// PATH: src/app_admin/domains/landing/pages/LandingSamplesPage.tsx
// 1번 tenant 프로모 내 랜딩 샘플 갤러리.
// PromoLayout 바깥에서 렌더링되므로 자체 헤더/네비 제공.

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getTemplateComponent } from "../templates";
import type { LandingConfig, TemplateKey } from "../types";

const SAMPLE_CONFIGS: Record<TemplateKey, { meta: { name: string; mood: string; description: string; color: string }; config: LandingConfig }> = {
  minimal_tutor: {
    meta: { name: "Minimal Tutor", mood: "밝음 · 깔끔 · 신뢰", description: "밝은 배경과 넓은 여백으로 깔끔한 인상을 주는 미니멀 디자인. 과외·소규모 학원에 잘 어울립니다.", color: "#2563EB" },
    config: {
      brand_name: "수학의 정석",
      tagline: "체계적인 수학 교육의 시작",
      subtitle: "15년 경력의 전문 강사가 학생 한 명 한 명을 책임집니다. 기초부터 심화까지 체계적인 커리큘럼으로 실력을 키워갑니다.",
      primary_color: "#2563EB",
      hero_image_url: "",
      logo_url: "",
      cta_text: "수업 시작하기",
      cta_link: "/login",
      contact: { phone: "02-1234-5678", email: "math@example.com", address: "서울시 강남구 대치동" },
      sections: [
        { type: "hero", enabled: true, order: 0 },
        { type: "features", enabled: true, order: 1, items: [
          { icon: "book", title: "체계적인 커리큘럼", description: "교과서부터 경시대회까지, 수준별 맞춤 학습 로드맵을 제공합니다" },
          { icon: "chart", title: "실시간 성적 분석", description: "매주 실시되는 테스트와 AI 기반 취약점 분석으로 효율적인 학습" },
          { icon: "users", title: "밀착 관리", description: "소수 정예 수업과 1:1 상담으로 학생 개인에 집중합니다" },
        ] },
        { type: "about", enabled: true, order: 2, title: "선생님 소개", description: "서울대학교 수학교육과를 졸업하고, 15년간 중·고등학생을 가르쳐왔습니다.\n\n학생이 수학을 '이해'하는 것을 넘어 '좋아하게' 되는 수업을 목표로 합니다." },
        { type: "testimonials", enabled: true, order: 3, items: [
          { name: "김OO 학부모", text: "아이가 수학 시간을 기다리게 되었어요. 성적도 올랐지만, 자신감이 생긴 게 가장 큰 변화입니다.", role: "중2 학부모" },
          { name: "이OO 학부모", text: "꼼꼼한 관리와 정확한 피드백 덕분에 부모로서 안심이 됩니다.", role: "고1 학부모" },
        ] },
        { type: "faq", enabled: true, order: 4, items: [
          { question: "수업은 어떻게 진행되나요?", answer: "주 2회 정규 수업과 주 1회 자습 관리로 진행됩니다. 수준별 반편성으로 최적의 학습 환경을 제공합니다." },
          { question: "상담은 어떻게 받을 수 있나요?", answer: "전화 또는 카카오톡으로 언제든 상담 예약이 가능합니다." },
        ] },
        { type: "contact", enabled: true, order: 5 },
      ],
    },
  },
  premium_dark: {
    meta: { name: "Premium Dark", mood: "프리미엄 · 세련 · 고급", description: "네이비/다크 기반의 프리미엄 톤으로 전문성과 고급스러움을 강조합니다.", color: "#1E3A5F" },
    config: {
      brand_name: "엘리트 영어",
      tagline: "최상위권을 위한 영어 교육",
      subtitle: "Top 1% 학생들이 선택하는 프리미엄 영어 전문 학원. 수능, 내신, 특목고 입시를 동시에 준비합니다.",
      primary_color: "#1E3A5F",
      hero_image_url: "",
      logo_url: "",
      cta_text: "상담 신청",
      cta_link: "/login",
      contact: { phone: "02-555-1234", email: "elite@example.com", address: "서울시 서초구 반포동" },
      sections: [
        { type: "hero", enabled: true, order: 0 },
        { type: "features", enabled: true, order: 1, items: [
          { icon: "star", title: "원어민 수준 커리큘럼", description: "미국 교과서 기반 리딩과 에세이 작성 중심 수업" },
          { icon: "shield", title: "입시 전략 컨설팅", description: "학생별 맞춤 입시 전략과 로드맵 설계" },
          { icon: "award", title: "검증된 실적", description: "매년 특목고·자사고 합격생 다수 배출" },
        ] },
        { type: "programs", enabled: true, order: 2, items: [
          { title: "수능 영어 마스터", description: "수능 영어 1등급을 위한 체계적 학습 프로그램", badge: "BEST" },
          { title: "내신 완성반", description: "학교별 맞춤 내신 대비와 서술형 특강", badge: "NEW" },
          { title: "특목고 대비반", description: "입학 시험 대비 집중 프로그램", badge: "" },
        ] },
        { type: "testimonials", enabled: true, order: 3, items: [
          { name: "박OO", text: "영어 1등급을 놓친 적이 없습니다. 체계적인 관리 덕분입니다.", role: "고3 학생" },
          { name: "최OO 학부모", text: "다른 학원과 차원이 다릅니다. 아이의 변화가 눈에 보입니다.", role: "중3 학부모" },
        ] },
        { type: "contact", enabled: true, order: 4 },
      ],
    },
  },
  academic_trust: {
    meta: { name: "Academic Trust", mood: "체계 · 관리 · 성과", description: "성적 관리와 체계적 교육을 시각적으로 전달하는 신뢰형 디자인.", color: "#4F46E5" },
    config: {
      brand_name: "정석학원",
      tagline: "데이터로 증명하는 교육",
      subtitle: "학생 한 명 한 명의 학습 데이터를 분석하여 최적의 학습 경로를 설계합니다.",
      primary_color: "#4F46E5",
      hero_image_url: "",
      logo_url: "",
      cta_text: "학습 상담 받기",
      cta_link: "/login",
      contact: { phone: "031-789-1234", email: "info@jeongsuk.com", address: "경기도 성남시 분당구" },
      sections: [
        { type: "hero", enabled: true, order: 0 },
        { type: "features", enabled: true, order: 1, items: [
          { icon: "chart", title: "AI 성적 분석", description: "매주 자동 성적 분석 리포트를 학부모에게 전송합니다" },
          { icon: "clock", title: "출석 관리", description: "실시간 출석 알림과 학습 시간 관리" },
          { icon: "check", title: "클리닉 시스템", description: "오답 분석 기반 맞춤형 보강 수업 자동 편성" },
          { icon: "users", title: "학부모 소통", description: "상담 기록, 성적 리포트 실시간 공유" },
        ] },
        { type: "about", enabled: true, order: 2, title: "교육 철학", description: "우리는 '가르치는 것'이 아니라 '학습하게 하는 것'이 교육이라고 믿습니다.\n\n모든 학생은 자신만의 속도가 있습니다. 그 속도를 존중하면서도 목표에 도달할 수 있도록 체계적으로 관리합니다." },
        { type: "faq", enabled: true, order: 3, items: [
          { question: "성적이 오르지 않으면 어떻게 하나요?", answer: "4주 단위로 학습 성과를 분석하고, 필요 시 커리큘럼을 즉시 조정합니다." },
          { question: "학부모는 어떻게 확인하나요?", answer: "전용 앱을 통해 출석, 성적, 상담 기록을 실시간으로 확인할 수 있습니다." },
          { question: "수업 규모는 어떻게 되나요?", answer: "반당 최대 8명의 소수 정예로 운영합니다." },
        ] },
        { type: "contact", enabled: true, order: 4 },
      ],
    },
  },
  program_promo: {
    meta: { name: "Program Promo", mood: "홍보 · 활기 · 행동유도", description: "프로그램 소개와 CTA 중심의 활기찬 홍보형 디자인. 신규 모집에 효과적입니다.", color: "#F97316" },
    config: {
      brand_name: "코딩랩",
      tagline: "미래를 코딩하는 아이들",
      subtitle: "초등학생도 쉽게 배우는 코딩 교육. 스크래치부터 파이썬까지, 단계별로 성장합니다.",
      primary_color: "#F97316",
      hero_image_url: "",
      logo_url: "",
      cta_text: "무료 체험 신청",
      cta_link: "/login",
      contact: { phone: "070-1234-5678", email: "hello@codinglab.kr", address: "" },
      sections: [
        { type: "hero", enabled: true, order: 0 },
        { type: "features", enabled: true, order: 1, items: [
          { icon: "target", title: "프로젝트 기반 학습", description: "매 수업 실제 프로젝트를 완성하며 성취감을 경험합니다" },
          { icon: "heart", title: "재미있는 수업", description: "게임, 앱, 로봇 등 아이가 좋아하는 주제로 코딩을 배웁니다" },
          { icon: "award", title: "대회 준비", description: "정보올림피아드, 코딩 경진대회 준비까지 지원합니다" },
        ] },
        { type: "programs", enabled: true, order: 2, items: [
          { title: "스크래치 입문반", description: "코딩이 처음인 아이를 위한 블록 코딩 과정 (초1~초3)", badge: "입문" },
          { title: "파이썬 기초반", description: "텍스트 코딩의 세계로! 게임 만들며 배우는 파이썬 (초4~초6)", badge: "인기" },
          { title: "알고리즘반", description: "정보올림피아드와 대회 준비를 위한 심화 과정 (중등)", badge: "심화" },
        ] },
        { type: "testimonials", enabled: true, order: 3, items: [
          { name: "정OO 학부모", text: "아이가 집에서도 코딩을 할 정도로 좋아합니다. 자기주도적으로 학습하는 습관이 생겼어요.", role: "초4 학부모" },
          { name: "한OO", text: "정보올림피아드 본선에 진출할 수 있었던 건 코딩랩 덕분입니다!", role: "중2 학생" },
        ] },
        { type: "faq", enabled: true, order: 4, items: [
          { question: "코딩을 처음 배우는데 괜찮을까요?", answer: "물론입니다! 스크래치 입문반은 코딩 경험이 전혀 없는 아이도 쉽게 시작할 수 있도록 설계되었습니다." },
          { question: "수업 준비물이 있나요?", answer: "노트북은 학원에서 제공합니다. 별도 준비물은 없습니다." },
        ] },
        { type: "contact", enabled: true, order: 5 },
      ],
    },
  },
};

const TEMPLATE_KEYS: TemplateKey[] = ["minimal_tutor", "premium_dark", "academic_trust", "program_promo"];

export default function LandingSamplesPage() {
  const [selectedKey, setSelectedKey] = useState<TemplateKey | null>(null);

  // 페이지 타이틀 설정
  useEffect(() => {
    document.title = selectedKey
      ? `${SAMPLE_CONFIGS[selectedKey].meta.name} 미리보기 — 학원플러스`
      : "랜딩 페이지 샘플 — 학원플러스";
    return () => { document.title = "학원플러스"; };
  }, [selectedKey]);

  // 풀스크린 프리뷰 모드
  if (selectedKey) {
    const sample = SAMPLE_CONFIGS[selectedKey];
    const Template = getTemplateComponent(selectedKey);
    const currentIdx = TEMPLATE_KEYS.indexOf(selectedKey);
    const prevKey = currentIdx > 0 ? TEMPLATE_KEYS[currentIdx - 1] : null;
    const nextKey = currentIdx < TEMPLATE_KEYS.length - 1 ? TEMPLATE_KEYS[currentIdx + 1] : null;

    return (
      <div style={{ minHeight: "100vh" }}>
        {/* Preview toolbar */}
        <div style={{
          position: "sticky", top: 0, zIndex: 100,
          background: "rgba(255,255,255,0.97)", backdropFilter: "blur(16px)",
          borderBottom: "1px solid #e2e8f0", padding: "0 24px",
        }}>
          <div style={{ maxWidth: 1120, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 52 }}>
            <button
              onClick={() => setSelectedKey(null)}
              style={{ display: "flex", alignItems: "center", gap: 6, border: "none", background: "none", cursor: "pointer", fontSize: 14, fontWeight: 600, color: "#2563EB", padding: "6px 0" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
              목록
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: sample.meta.color }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{sample.meta.name}</span>
              <span style={{ fontSize: 12, color: "#94a3b8" }}>{sample.meta.mood}</span>
            </div>

            <div style={{ display: "flex", gap: 4 }}>
              {prevKey && (
                <button onClick={() => setSelectedKey(prevKey)} style={{ padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: 6, background: "#fff", cursor: "pointer", fontSize: 12, color: "#64748b" }}>
                  ← 이전
                </button>
              )}
              {nextKey && (
                <button onClick={() => setSelectedKey(nextKey)} style={{ padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: 6, background: "#fff", cursor: "pointer", fontSize: 12, color: "#64748b" }}>
                  다음 →
                </button>
              )}
            </div>
          </div>
        </div>
        <Template config={sample.config} isPreview />
      </div>
    );
  }

  // 갤러리 목록
  return (
    <div style={{ minHeight: "100vh", background: "#fff" }}>
      {/* Header */}
      <div style={{ background: "rgba(255,255,255,0.97)", backdropFilter: "blur(12px)", borderBottom: "1px solid #e2e8f0", padding: "0 24px", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 52 }}>
          <Link to="/promo" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 600, color: "#2563EB", textDecoration: "none" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
            학원플러스
          </Link>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>랜딩 페이지 샘플</span>
          <Link to="/promo/demo" style={{ padding: "6px 16px", background: "#2563EB", color: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
            데모 요청
          </Link>
        </div>
      </div>

      {/* Hero */}
      <div style={{ padding: "56px 24px 0", textAlign: "center" }}>
        <div style={{ display: "inline-flex", padding: "5px 14px", borderRadius: 99, background: "#eff6ff", border: "1px solid #dbeafe", marginBottom: 20 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#2563EB", letterSpacing: "0.03em" }}>4종 프리미엄 템플릿</span>
        </div>
        <h1 style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 800, margin: "0 0 16px", letterSpacing: "-0.025em", color: "#0f172a", lineHeight: 1.2 }}>
          선생님 전용 랜딩 페이지
        </h1>
        <p style={{ fontSize: "clamp(15px, 2vw, 18px)", color: "#64748b", margin: "0 auto", lineHeight: 1.7, maxWidth: 560 }}>
          각 템플릿을 클릭하면 실제 페이지를 미리 볼 수 있습니다.
          <br />설정에서 바로 적용하고 커스터마이즈할 수 있습니다.
        </p>
      </div>

      {/* Grid */}
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "48px 24px 80px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 460px), 1fr))", gap: 28 }}>
          {TEMPLATE_KEYS.map((key) => {
            const sample = SAMPLE_CONFIGS[key];
            return (
              <div
                key={key}
                onClick={() => setSelectedKey(key)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && setSelectedKey(key)}
                style={{
                  borderRadius: 16, overflow: "hidden",
                  border: "1px solid #e2e8f0", background: "#fff",
                  cursor: "pointer", transition: "all 0.2s ease",
                }}
                onMouseOver={(e) => { e.currentTarget.style.boxShadow = "0 12px 40px rgba(0,0,0,0.08)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseOut={(e) => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "translateY(0)"; }}
              >
                {/* Thumbnail */}
                <div style={{ height: 260, overflow: "hidden", position: "relative", pointerEvents: "none", background: key === "premium_dark" ? "#0B1120" : "#f8fafc" }}>
                  <div style={{ transform: "scale(0.42)", transformOrigin: "top left", width: "238%", height: "238%" }}>
                    {(() => { const T = getTemplateComponent(key); return <T config={sample.config} isPreview />; })()}
                  </div>
                  <div style={{ position: "absolute", inset: 0, background: key === "premium_dark" ? "linear-gradient(180deg, transparent 50%, rgba(11,17,32,0.8) 100%)" : "linear-gradient(180deg, transparent 50%, rgba(255,255,255,0.85) 100%)" }} />
                  {/* Hover overlay */}
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity 0.2s" }}
                    className="sample-hover-overlay"
                  >
                    <span style={{ padding: "10px 24px", background: "rgba(0,0,0,0.7)", color: "#fff", borderRadius: 10, fontSize: 14, fontWeight: 600, backdropFilter: "blur(4px)" }}>
                      미리보기 →
                    </span>
                  </div>
                </div>

                {/* Info */}
                <div style={{ padding: "18px 22px 22px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: sample.meta.color, flexShrink: 0 }} />
                    <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "#0f172a" }}>{sample.meta.name}</h3>
                    <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: "auto", fontWeight: 500 }}>{sample.meta.mood}</span>
                  </div>
                  <p style={{ fontSize: 14, color: "#64748b", margin: 0, lineHeight: 1.6 }}>{sample.meta.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom CTA */}
      <div style={{ padding: "48px 24px 64px", background: "#f8fafc", textAlign: "center", borderTop: "1px solid #e2e8f0" }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 12px", color: "#0f172a" }}>마음에 드는 템플릿이 있으신가요?</h2>
        <p style={{ fontSize: 15, color: "#64748b", margin: "0 0 24px" }}>학원플러스에 가입하면 설정에서 바로 적용할 수 있습니다.</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link to="/promo/demo" style={{ padding: "12px 28px", background: "#2563EB", color: "#fff", borderRadius: 10, fontSize: 15, fontWeight: 700, textDecoration: "none" }}>
            데모 요청하기
          </Link>
          <Link to="/promo" style={{ padding: "12px 28px", background: "#fff", color: "#475569", borderRadius: 10, fontSize: 15, fontWeight: 600, textDecoration: "none", border: "1px solid #e2e8f0" }}>
            서비스 더 알아보기
          </Link>
        </div>
      </div>
    </div>
  );
}
