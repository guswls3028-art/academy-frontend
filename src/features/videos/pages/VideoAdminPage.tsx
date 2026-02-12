// PATH: src/features/videos/pages/VideoControlCenter.tsx

import {
  Panel,
  Section,
  KPI,
  Button,
  StatusBadge,
} from "@/shared/ui/ds";
import { DomainLayout } from "@/shared/ui/layout";

export default function VideoControlCenter() {
  return (
    <DomainLayout
      title="생명과학 영상 관리"
      description="생명과학 전 강의 영상 자산을 통합 관리합니다."
    >
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-end">
          <Button intent="primary" size="md">
            영상 업로드
          </Button>
        </div>

        {/* KPI */}
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
                  "var(--bg-surface)",
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
        <div>
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
        </div>
      </Panel>

        <div className="text-center text-xs font-semibold text-[var(--color-text-muted)]">
          HakwonPlus · Biology Video Platform
        </div>
      </div>
    </DomainLayout>
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
    <Button
      type="button"
      intent={active ? "primary" : "ghost"}
      size="sm"
      className="!gap-2 !text-xs"
    >
      <span>{label}</span>
      <span
        className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
        style={{
          background: "var(--color-bg-surface-hover)",
          color: active ? "var(--text-on-primary)" : toneColor,
        }}
      >
        {count}
      </span>
    </Button>
  );
}
