// PATH: src/features/dashboard/pages/AdminDashboard_v1.tsx

import { Page, PageHeader, Section, Panel, KPI } from "@/shared/ui/ds";
import { Table, Button, Tag } from "antd";

export default function AdminDashboardV1() {
  return (
    <Page width="wide" density="focus" background="app">
      {/* ===== PAGE HEADER (L1) ===== */}
      <PageHeader
        title="운영 대시보드"
        description="오늘 기준으로 학원 운영 상태를 요약합니다"
        actions={
          <Button type="primary" size="middle">
            오늘 리포트 생성
          </Button>
        }
        sticky
      />

      {/* ===== PRIMARY SECTION (L2) ===== */}
      <Section level="primary">
        <Panel variant="primary">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "var(--space-5)",
            }}
          >
            <KPI label="재원 학생" value={248} />
            <KPI label="출결 주의" value={7} hint="최근 7일 기준" />
            <KPI label="성적 관리 대상" value={12} />
            <KPI label="상담 대기" value={3} />
          </div>
        </Panel>
      </Section>

      {/* ===== SECONDARY SECTION (L3) ===== */}
      <Section
        level="secondary"
        title="오늘 처리해야 할 항목"
        description="관리자가 즉시 확인해야 하는 핵심 작업"
      >
        <Panel>
          <Table
            pagination={false}
            rowKey="key"
            columns={[
              {
                title: "항목",
                dataIndex: "task",
                render: (v) => <strong>{v}</strong>,
              },
              {
                title: "대상",
                dataIndex: "target",
              },
              {
                title: "상태",
                dataIndex: "status",
                render: (v) =>
                  v === "주의" ? (
                    <Tag color="warning">주의</Tag>
                  ) : (
                    <Tag color="default">정상</Tag>
                  ),
              },
              {
                title: "",
                render: () => (
                  <Button type="link" size="small">
                    상세
                  </Button>
                ),
              },
            ]}
            dataSource={[
              {
                key: 1,
                task: "출결 누락 확인",
                target: "중등 2학년",
                status: "주의",
              },
              {
                key: 2,
                task: "성적 미반영 시험",
                target: "고1 수학",
                status: "정상",
              },
              {
                key: 3,
                task: "상담 요청 대기",
                target: "학생 3명",
                status: "주의",
              },
            ]}
          />
        </Panel>
      </Section>

      {/* ===== TERTIARY SECTION (L4) ===== */}
      <Section
        level="tertiary"
        title="최근 활동 로그"
        description="참고용 기록"
      >
        <Panel variant="subtle">
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            <li>김민수 학생 성적 수정 (10분 전)</li>
            <li>중3 수학 시험 결과 반영 (35분 전)</li>
            <li>상담 일정 생성 (1시간 전)</li>
          </ul>
        </Panel>
      </Section>
    </Page>
  );
}
