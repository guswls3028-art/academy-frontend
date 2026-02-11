// PATH: src/features/dashboard/pages/DashboardDemoPage.tsx
/**
 * 🧪 DashboardDemoPage (ADMIN / DEMO ONLY)
 *
 * 목적:
 * - 학원 운영 전체 현황 한눈에 보여주는 홍보용
 * - KPI / 그래프 / 최근 활동
 *
 * 주의:
 * - 실제 데이터 X
 * - 캡쳐 / 제안서 / 랜딩 페이지용
 */

export default function DashboardDemoPage() {
  return (
    <div style={page}>
      <h1 style={title}>Academy Operations Dashboard</h1>

      {/* KPI */}
      <div style={kpiGrid}>
        <KPI label="오늘 출석률" value="94%" />
        <KPI label="영상 시청률" value="88%" />
        <KPI label="진행 중 시험" value="6건" />
        <KPI label="미채점 항목" value="12개" />
      </div>

      {/* Main */}
      <div style={mainGrid}>
        {/* Chart */}
        <Card title="주간 학습 지표">
          <div style={chartMock}>📊 Weekly Performance Chart</div>
        </Card>

        {/* Activity */}
        <Card title="최근 활동">
          <ul style={list}>
            <li>· 3학년 2반 중간고사 채점 완료</li>
            <li>· 물리 OT 영상 업로드</li>
            <li>· 학생 12명 출석 확인</li>
            <li>· 영상 시청 제한 정책 변경</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

/* ---------------- styles ---------------- */

const page: React.CSSProperties = {
  padding: 32,
  background: "#f5f7fb",
  minHeight: "100vh",
};

const title: React.CSSProperties = {
  fontSize: 26,
  fontWeight: 900,
  marginBottom: 24,
};

const kpiGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: 20,
  marginBottom: 28,
};

const mainGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "2fr 1fr",
  gap: 24,
};

const chartMock: React.CSSProperties = {
  height: 240,
  borderRadius: 12,
  background: "linear-gradient(135deg, #e0e7ff, #f8fafc)",
  display: "grid",
  placeItems: "center",
  fontWeight: 700,
  color: "#475569",
};

const list: React.CSSProperties = {
  margin: 0,
  paddingLeft: 16,
  fontSize: 14,
  lineHeight: 1.7,
};

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div style={kpi}>
      <div style={kpiLabel}>{label}</div>
      <div style={kpiValue}>{value}</div>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={card}>
      <div style={cardTitle}>{title}</div>
      {children}
    </div>
  );
}

const kpi: React.CSSProperties = {
  background: "#fff",
  borderRadius: 16,
  padding: 20,
  boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
};

const kpiLabel: React.CSSProperties = {
  fontSize: 13,
  color: "#64748b",
  fontWeight: 700,
};

const kpiValue: React.CSSProperties = {
  marginTop: 6,
  fontSize: 28,
  fontWeight: 900,
};

const card: React.CSSProperties = {
  background: "#fff",
  borderRadius: 18,
  padding: 20,
  boxShadow: "0 12px 36px rgba(0,0,0,0.1)",
};

const cardTitle: React.CSSProperties = {
  fontWeight: 800,
  marginBottom: 12,
};
