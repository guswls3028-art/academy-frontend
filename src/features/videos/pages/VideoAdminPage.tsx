// PATH: src/features/videos/pages/VideoControlCenter.tsx

import {
  Page,
  PageHeader,
  Panel,
  Section,
  KPI,
  WorkZone,
  Button,
  StatusBadge,
} from "@/shared/ui/ds";

export default function VideoControlCenter() {
  return (
    <Page width="full" density="focus">
      {/* ===============================
          HEADER (COMPACT)
      =============================== */}
      <PageHeader
        title="생명과학 영상 관리"
        description="생명과학 전 강의 영상 자산을 통합 관리합니다."
        badge={<StatusBadge status="active" />}
        actions={
          <Button intent="primary" size="md">
            영상 업로드
          </Button>
        }
        meta="BIOLOGY VIDEO CONTROL · INTERNAL"
        variant="card"
        importance="normal"
      />

      {/* ===============================
          KPI OVERVIEW
      =============================== */}
      <Section level="primary" title="운영 요약">
        <div className="grid grid-cols-4 gap-6">
          <KPI label="총 영상 수" value="40" hint="생명과학 전체" />
          <KPI label="총 재생 시간" value="62h" hint="순수 콘텐츠 기준" />
          <KPI label="운영 강의" value="6" hint="고1~고3" />
          <KPI label="최근 업데이트" value="3" hint="7일 기준" />
        </div>
      </Section>

      {/* ===============================
          MAIN CONTROL PANEL
      =============================== */}
      <Panel
        title="영상 목록"
        description="강의·차시 구분 없이 모든 생명과학 영상을 관리합니다."
        right={
          <div className="flex items-center gap-3">
            {/* === CONTROL STRIP === */}
            <div
              className="flex items-center gap-2 px-2 py-1 rounded-xl border"
              style={{
                borderColor: "var(--color-border-divider)",
                background:
                  "linear-gradient(180deg, var(--color-bg-surface-hover), var(--color-bg-surface))",
              }}
            >
              <ControlTab label="전체" count={40} active />
              <ControlTab label="활성" count={34} tone="active" />
              <ControlTab label="비활성" count={4} tone="inactive" />
              <ControlTab label="보관" count={2} tone="archived" />
            </div>

            <Button intent="ghost" size="sm">
              필터
            </Button>
          </div>
        }
      >
        <WorkZone>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[var(--color-text-muted)]">
                <th className="py-3">강의</th>
                <th>차시</th>
                <th>영상 제목</th>
                <th>길이</th>
                <th>상태</th>
                <th>최근 수정</th>
                <th />
              </tr>
            </thead>

            <tbody className="divide-y divide-[var(--color-border-divider)]">
              {[
                {
                  lecture: "고3 생명과학Ⅰ",
                  session: "12강",
                  title: "유전자 발현 조절 핵심 정리",
                  duration: "42:10",
                  status: "active",
                  updated: "2026-02-08",
                },
                {
                  lecture: "고2 생명과학 내신",
                  session: "5강",
                  title: "세포 주기와 분열",
                  duration: "35:48",
                  status: "active",
                  updated: "2026-02-05",
                },
                {
                  lecture: "고1 생명과학 기초",
                  session: "2강",
                  title: "효소와 대사 작용",
                  duration: "29:22",
                  status: "inactive",
                  updated: "2026-01-26",
                },
              ].map((v, i) => (
                <tr key={i} className="hover:bg-[var(--color-bg-surface-hover)]">
                  <td className="py-4 font-semibold">{v.lecture}</td>
                  <td>{v.session}</td>
                  <td className="font-medium">{v.title}</td>
                  <td>{v.duration}</td>
                  <td>
                    <StatusBadge status={v.status as any} />
                  </td>
                  <td>{v.updated}</td>
                  <td className="text-right">
                    <Button intent="ghost" size="sm">
                      관리
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </WorkZone>
      </Panel>

      {/* ===============================
          FOOTER
      =============================== */}
      <div className="text-center text-xs font-semibold text-[var(--color-text-muted)] mt-10">
        HakwonPlus · Biology Video Platform
      </div>
    </Page>
  );
}

/* ===============================
   INTERNAL CONTROL TAB
=============================== */
function ControlTab({
  label,
  count,
  active,
  tone = "default",
}: {
  label: string;
  count: number;
  active?: boolean;
  tone?: "default" | "active" | "inactive" | "archived";
}) {
  const toneColor =
    tone === "active"
      ? "var(--color-success)"
      : tone === "inactive"
      ? "var(--color-text-muted)"
      : tone === "archived"
      ? "var(--color-text-secondary)"
      : "var(--color-text-primary)";

  return (
    <button
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold"
      style={{
        background: active ? "var(--color-bg-surface)" : "transparent",
        color: toneColor,
        border: active
          ? "1px solid var(--color-border-divider)"
          : "1px solid transparent",
        boxShadow: active ? "0 1px 0 rgba(0,0,0,0.08)" : "none",
      }}
    >
      <span>{label}</span>
      <span
        className="px-2 py-0.5 rounded-full text-[11px]"
        style={{
          background: "var(--color-bg-surface-hover)",
          color: toneColor,
          fontWeight: 900,
        }}
      >
        {count}
      </span>
    </button>
  );
}
