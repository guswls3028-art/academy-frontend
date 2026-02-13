// PATH: src/features/dashboard/pages/DashboardPage.tsx
/**
 * Dashboard — 학원 운영 현황 + 미처리 일감 한곳에
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchCommunityQuestions } from "@/features/community/api/community.api";
import { useMessagingInfo } from "@/features/messages/hooks/useMessagingInfo";
import ChargeCreditsModal from "@/features/messages/components/ChargeCreditsModal";
import { DomainLayout } from "@/shared/ui/layout";
import { KPI, Button } from "@/shared/ui/ds";

export default function DashboardPage() {
  const navigate = useNavigate();
  const [chargeModalOpen, setChargeModalOpen] = useState(false);
  const { data: messagingInfo } = useMessagingInfo();

  const { data: questions = [] } = useQuery({
    queryKey: ["dashboard-pending-questions"],
    queryFn: () => fetchCommunityQuestions(null),
    staleTime: 60 * 1000,
  });
  const pendingQnaCount = questions.filter((q) => !q.is_answered).length;

  return (
    <DomainLayout
      title="대시보드"
      description="학원 운영 현황을 한눈에 확인하세요."
    >
      <div style={page}>
        {/* 미처리 일감 — 클릭 시 해당 목록 */}
        <div style={sectionTitle}>미처리 일감</div>
        <div style={todoGrid}>
          <TodoCard
            label="미답변 질의"
            value={pendingQnaCount}
            suffix="건"
            onClick={() => navigate("/admin/community/qna")}
          />
          <TodoCard
            label="채점 대기"
            value="보기"
            onClick={() => navigate("/admin/results")}
          />
          <TodoCard
            label="게시 관리"
            value="공지·게시판"
            onClick={() => navigate("/admin/community/admin")}
          />
        </div>

        {/* 알림톡 잔액 + 충전 */}
        <div style={sectionTitle}>알림톡</div>
        <div style={balanceRow}>
          <div style={balanceCard}>
            <div style={kpiLabel}>현재 잔액</div>
            <div style={kpiValue}>
              {messagingInfo
                ? `${Number(messagingInfo.credit_balance).toLocaleString()}원`
                : "—"}
            </div>
            <Button
              size="sm"
              intent="primary"
              onClick={() => setChargeModalOpen(true)}
              style={{ marginTop: 12 }}
            >
              충전하기
            </Button>
          </div>
        </div>

        {/* KPI */}
        <div style={sectionTitle}>요약 지표</div>
        <div style={kpiGrid}>
          <KPI label="오늘 출석률" value="94%" />
          <KPI label="영상 시청률" value="88%" />
          <KPI label="진행 중 시험" value="6건" />
          <KPI label="미채점 항목" value="12개" />
        </div>

        {/* Main */}
        <div style={mainGrid}>
          <Card title="주간 학습 지표">
            <div style={chartMock}>📊 Weekly Performance Chart</div>
          </Card>
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

      <ChargeCreditsModal
        open={chargeModalOpen}
        onClose={() => setChargeModalOpen(false)}
      />
    </DomainLayout>
  );
}

function TodoCard({
  label,
  value,
  suffix,
  onClick,
}: {
  label: string;
  value: number | string;
  suffix?: string;
  onClick: () => void;
}) {
  const display = typeof value === "number" ? `${value}${suffix ?? ""}` : value;
  return (
    <button
      type="button"
      onClick={onClick}
      style={todoCard}
      className="ds-kpi hover:bg-[var(--color-bg-elevated)] hover:border-[var(--color-border-strong)]"
    >
      <div style={kpiLabel}>{label}</div>
      <div style={kpiValue}>{display}</div>
    </button>
  );
}

/* ---------------- styles ---------------- */

const page: React.CSSProperties = {
  padding: 0,
};

const sectionTitle: React.CSSProperties = {
  fontSize: "var(--text-sm)",
  fontWeight: 700,
  color: "var(--color-text-secondary)",
  marginBottom: 12,
};

const todoGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 16,
  marginBottom: 28,
};

const todoCard: React.CSSProperties = {
  textAlign: "left",
  cursor: "pointer",
  border: "1px solid var(--color-border-divider)",
  borderRadius: "var(--radius-xl)",
  padding: "var(--space-4)",
  background: "var(--color-bg-surface)",
  transition: "background 0.15s, border-color 0.15s",
};

const balanceRow: React.CSSProperties = {
  marginBottom: 28,
};

const balanceCard: React.CSSProperties = {
  display: "inline-block",
  textAlign: "left",
  border: "1px solid var(--color-border-divider)",
  borderRadius: "var(--radius-xl)",
  padding: "var(--space-4)",
  background: "var(--color-bg-surface)",
  minWidth: 200,
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
  background: "var(--bg-surface)",
  display: "grid",
  placeItems: "center",
  fontWeight: 700,
  color: "var(--color-text-secondary)",
};

const list: React.CSSProperties = {
  margin: 0,
  paddingLeft: 16,
  fontSize: 14,
  lineHeight: 1.7,
};

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
