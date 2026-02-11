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

export default function ResultControlCenter() {
  return (
    <Page width="full" density="focus">
      {/* ===============================
          HEADER
      =============================== */}
      <PageHeader
        title="성적·결과 통합 관리"
        description="시험 · 과제 · 클리닉 결과를 한 번에 분석합니다."
        badge={<StatusBadge status="active" />}
        actions={
          <Button intent="primary" size="md">
            리포트 다운로드
          </Button>
        }
        meta="BIOLOGY RESULTS & ANALYTICS"
        variant="card"
      />

      {/* ===============================
          KPI
      =============================== */}
      <Section level="primary" title="성과 요약">
        <div className="grid grid-cols-4 gap-6">
          <KPI label="평균 점수" value="84.6" hint="최근 시험" />
          <KPI label="합격률" value="78%" hint="커리큘럼 기준" />
          <KPI label="클리닉 대상" value="92" hint="자동 분류" />
          <KPI label="재시험 비율" value="14%" hint="운영 지표" />
        </div>
      </Section>

      {/* ===============================
          RESULTS TABLE
      =============================== */}
      <Panel
        title="학생 결과 현황"
        description="강의·시험 단위 성적을 통합 조회합니다."
        right={
          <div className="flex items-center gap-3">
            <Button intent="ghost" size="sm">시험 선택</Button>
            <Button intent="ghost" size="sm">학교 선택</Button>
          </div>
        }
      >
        <WorkZone>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[var(--color-text-muted)]">
                <th className="py-3">학생</th>
                <th>강의</th>
                <th>점수</th>
                <th>판정</th>
                <th>클리닉</th>
                <th />
              </tr>
            </thead>

            <tbody className="divide-y divide-[var(--color-border-divider)]">
              {[
                {
                  name: "김○○",
                  lecture: "고3 생명과학Ⅰ",
                  score: "92 / 100",
                  passed: true,
                  clinic: false,
                },
                {
                  name: "이○○",
                  lecture: "고2 생명과학 내신",
                  score: "71 / 100",
                  passed: false,
                  clinic: true,
                },
                {
                  name: "박○○",
                  lecture: "고1 생명과학 기초",
                  score: "88 / 100",
                  passed: true,
                  clinic: false,
                },
              ].map((r, i) => (
                <tr key={i} className="hover:bg-[var(--color-bg-surface-hover)]">
                  <td className="py-4 font-semibold">{r.name}</td>
                  <td>{r.lecture}</td>
                  <td className="font-medium">{r.score}</td>
                  <td>
                    <StatusBadge
                      status={r.passed ? "success" : "inactive"}
                    />
                  </td>
                  <td>
                    {r.clinic ? (
                      <span className="text-sm font-semibold text-red-600">
                        필요
                      </span>
                    ) : (
                      <span className="text-sm text-[var(--color-text-muted)]">
                        -
                      </span>
                    )}
                  </td>
                  <td className="text-right">
                    <Button intent="ghost" size="sm">
                      상세
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </WorkZone>
      </Panel>

      <div className="mt-10 text-center text-xs font-semibold text-[var(--color-text-muted)]">
        HakwonPlus · Biology Results Intelligence Platform
      </div>
    </Page>
  );
}
