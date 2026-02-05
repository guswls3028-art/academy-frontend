// PATH: src/student/domains/dashboard/pages/DashboardPage.tsx

import StudentPageShell from "@/student/shared/ui/pages/StudentPageShell";
import { useStudentDashboard } from "../hooks/useStudentDashboard";
import EmptyState from "@/student/shared/ui/layout/EmptyState";
import { Link } from "react-router-dom";
import { formatYmd } from "@/student/shared/utils/date";

export default function DashboardPage() {
  const { data, isLoading, isError } = useStudentDashboard();

  if (isLoading) {
    return (
      <StudentPageShell title="홈">
        <div className="stu-muted">불러오는 중...</div>
      </StudentPageShell>
    );
  }

  if (isError || !data) {
    return (
      <StudentPageShell title="홈">
        <EmptyState title="홈을 불러오지 못했습니다." />
      </StudentPageShell>
    );
  }

  return (
    <StudentPageShell title="홈">
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        {/* ===============================
         * HERO / 학습 바로가기
         * =============================== */}
        <section style={heroCard}>
          <div style={heroTitle}>오늘의 학습</div>
          <div style={heroSub}>지금 바로 시작할 수 있는 항목</div>

          <div style={grid}>
            <HeroAction to="/student/assignments" label="과제 제출" />
            <HeroAction to="/student/materials" label="자료실" />
            <HeroAction to="/student/exams" label="시험" />
            <HeroAction to="/student/grades" label="성적" />
          </div>
        </section>

        {/* ===============================
         * 클리닉
         * =============================== */}
        <section>
          <SectionHeader title="클리닉" />
          <GlassCard>
            {data.today_sessions?.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {data.today_sessions.map((s) => (
                  <div key={s.id} style={row}>
                    <div>
                      <div style={{ fontWeight: 800 }}>{s.title}</div>
                      <div style={muted}>
                        {formatYmd(s.date ?? null)}
                      </div>
                    </div>
                    <Link to={`/student/sessions/${s.id}`} style={ghostBtn}>
                      열기
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div style={muted}>예정된 클리닉이 없습니다.</div>
            )}

            <div style={{ marginTop: 14 }}>
              <Link to="/student/clinic" style={primaryBtn}>
                클리닉 예약하기
              </Link>
            </div>
          </GlassCard>
        </section>

        {/* ===============================
         * 상담
         * =============================== */}
        <section>
          <SectionHeader title="상담" />
          <GlassCard>
            <div style={muted}>예정된 상담이 없습니다.</div>

            <div style={{ marginTop: 14 }}>
              <Link to="/student/counseling" style={primaryBtn}>
                상담 예약하기
              </Link>
            </div>
          </GlassCard>
        </section>
      </div>
    </StudentPageShell>
  );
}

/* ===============================
 * UI Components
 * =============================== */

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 10 }}>
      {title}
    </div>
  );
}

function GlassCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: 18,
        borderRadius: 18,
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
        boxShadow: "0 8px 30px rgba(0,0,0,0.35)",
        backdropFilter: "blur(6px)",
      }}
    >
      {children}
    </div>
  );
}

function HeroAction({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} style={heroBtn}>
      {label}
    </Link>
  );
}

/* ===============================
 * Styles
 * =============================== */

const heroCard: React.CSSProperties = {
  padding: 22,
  borderRadius: 22,
  background:
    "linear-gradient(135deg, #1e293b 0%, #020617 100%)",
  boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
};

const heroTitle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
};

const heroSub: React.CSSProperties = {
  fontSize: 12,
  color: "var(--stu-text-muted)",
  marginTop: 4,
};

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
  marginTop: 18,
};

const heroBtn: React.CSSProperties = {
  padding: "14px 0",
  borderRadius: 14,
  background: "rgba(255,255,255,0.08)",
  textAlign: "center",
  fontWeight: 900,
  textDecoration: "none",
  color: "#fff",
};

const row: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const muted: React.CSSProperties = {
  fontSize: 12,
  color: "var(--stu-text-muted)",
};

const primaryBtn: React.CSSProperties = {
  display: "inline-block",
  padding: "10px 16px",
  borderRadius: 14,
  background: "var(--stu-primary, #2563eb)",
  color: "#fff",
  fontWeight: 900,
  textDecoration: "none",
};

const ghostBtn: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 10,
  border: "1px solid var(--stu-border)",
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 800,
  color: "var(--stu-text)",
};
