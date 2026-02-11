// PATH: src/student/domains/media/pages/MediaDemoPage.tsx
/**
 * 🚑 MediaDemoPage (TEMP / DEMO ONLY)
 *
 * - 모바일 학생 영상 화면 데모
 * - 홍보 / 캡쳐 / 기획 검증 전용
 * - 전역 디자인, 토큰, 테마 전부 무시
 * - "대기업 학생 앱" 느낌으로 시각적 완성도만 집중
 *
 * ⚠ 실제 기능 없음
 */

export default function MediaDemoPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #0b1220 0%, #0e1628 100%)",
        display: "flex",
        justifyContent: "center",
        padding: "24px 0",
        boxSizing: "border-box",
      }}
    >
      {/* 📱 Mobile Frame */}
      <div
        style={{
          width: 390, // iPhone 14 Pro 기준
          background: "#0f172a",
          borderRadius: 28,
          overflow: "hidden",
          boxShadow: "0 40px 80px rgba(0,0,0,0.45)",
          color: "#e5e7eb",
        }}
      >
        {/* 상단 헤더 */}
        <div
          style={{
            padding: "16px 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(15,23,42,0.9)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>
              과학 심화 · 생명과학
            </div>
            <div style={{ fontSize: 12, opacity: 0.6 }}>
              1강 · 생명 과학의 이해 (OT)
            </div>
          </div>
          <div
            style={{
              fontSize: 12,
              padding: "4px 10px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.08)",
            }}
          >
            Q&A
          </div>
        </div>

        {/* ▶ 영상 영역 */}
        <div
          style={{
            background: "#000",
            aspectRatio: "16 / 9",
            position: "relative",
          }}
        >
          {/* 플레이 버튼 */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 52,
              color: "#fff",
              opacity: 0.9,
            }}
          >
            ▶
          </div>

          {/* 진행바 */}
          <div
            style={{
              position: "absolute",
              left: 12,
              right: 12,
              bottom: 12,
              height: 4,
              background: "rgba(255,255,255,0.25)",
              borderRadius: 999,
            }}
          >
            <div
              style={{
                width: "27%",
                height: "100%",
                background:
                  "linear-gradient(90deg, #38bdf8, #60a5fa)",
                borderRadius: 999,
              }}
            />
          </div>
        </div>

        {/* 본문 */}
        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
          {/* 시청 상태 카드 */}
          <Card>
            <Row label="시청 진행률" value="27%" />
            <Row label="누적 시청" value="5분 12초" />
            <Row label="완료 여부" value="미완료" highlight />
          </Card>

          {/* 강의 목록 */}
          <Card title="강의 목록">
            <ListItem active>1강 · 생명과학의 이해 (OT)</ListItem>
            <ListItem>2강 · 사람의 물질대사</ListItem>
            <ListItem>3강 · 항상성과 몸의 조절</ListItem>
            <ListItem>4강 · 유전</ListItem>
          </Card>

          {/* 제한 안내 */}
          <Card title="시청 제한">
            <Bullet>건너뛰기 제한</Bullet>
            <Bullet>최대 배속 1.0x</Bullet>
            <Bullet>워터마크 자동 적용</Bullet>
          </Card>
        </div>

        {/* 하단 네비 더미 */}
        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,0.08)",
            padding: "10px 0",
            display: "flex",
            justifyContent: "space-around",
            fontSize: 11,
            opacity: 0.8,
          }}
        >
          <NavItem label="홈" />
          <NavItem label="강의" active />
          <NavItem label="과제" />
          <NavItem label="마이" />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* UI 파츠 (전역 영향 없음) */

function Card({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.06)",
        borderRadius: 16,
        padding: 14,
      }}
    >
      {title && (
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            marginBottom: 8,
            color: "#e5e7eb",
          }}
        >
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        fontSize: 13,
        marginBottom: 6,
        color: highlight ? "#38bdf8" : "#cbd5f5",
      }}
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ListItem({
  children,
  active,
}: {
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <div
      style={{
        padding: "8px 0",
        fontSize: 13,
        color: active ? "#38bdf8" : "#cbd5f5",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {children}
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 4 }}>
      • {children}
    </div>
  );
}

function NavItem({
  label,
  active,
}: {
  label: string;
  active?: boolean;
}) {
  return (
    <div style={{ color: active ? "#38bdf8" : "#94a3b8" }}>
      {label}
    </div>
  );
}
