import {
  Panel,
  Section,
  KPI,
  Button,
  StatusBadge,
} from "@/shared/ui/ds";
import { DomainLayout } from "@/shared/ui/layout";

export default function ExamControlCenter() {
  return (
    <DomainLayout
      title="생명과학 시험 운영 센터"
      description="강의 · 차시 · 학교 단위 시험을 통합 운영합니다."
    >
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-end">
          <Button intent="primary" size="md">
            신규 시험 생성
          </Button>
        </div>

        {/* KPI */}
        <Section level="primary" title="시험 운영 요약">
        <div className="grid grid-cols-4 gap-6">
          <KPI label="운영 중 시험" value="9" hint="전체 강의 기준" />
          <KPI label="총 응시 인원" value="428" hint="최근 시험 기준" />
          <KPI label="채점 완료율" value="96%" hint="자동 + 수동" />
          <KPI label="클리닉 연계" value="7" hint="시험 기준" />
        </div>
      </Section>

      {/* ===============================
          EXAM TABLE
      =============================== */}
      <Panel
        title="시험 목록"
        description="강의·학교 단위 시험을 한 화면에서 관리합니다."
        right={
          <div className="flex items-center gap-3">
            <Button intent="ghost" size="sm">학교 필터</Button>
            <Button intent="ghost" size="sm">강의 필터</Button>
          </div>
        }
      >
        <div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[var(--color-text-muted)]">
                <th className="py-3">강의</th>
                <th>차시</th>
                <th>시험명</th>
                <th>대상 학교</th>
                <th>응시</th>
                <th>상태</th>
                <th />
              </tr>
            </thead>

            <tbody className="divide-y divide-[var(--color-border-divider)]">
              {[
                {
                  lecture: "고3 생명과학Ⅰ",
                  session: "12강",
                  title: "유전자 발현 단원 평가",
                  school: "대치고 · 휘문고",
                  count: 142,
                  status: "active",
                },
                {
                  lecture: "고2 생명과학 내신",
                  session: "5강",
                  title: "세포 주기 중간 점검",
                  school: "중동고",
                  count: 96,
                  status: "active",
                },
                {
                  lecture: "고1 생명과학 기초",
                  session: "2강",
                  title: "효소 단원 확인",
                  school: "대치고",
                  count: 54,
                  status: "inactive",
                },
              ].map((e, i) => (
                <tr key={i} className="hover:bg-[var(--color-bg-surface-hover)]">
                  <td className="py-4 font-semibold">{e.lecture}</td>
                  <td>{e.session}</td>
                  <td className="font-medium">{e.title}</td>
                  <td>{e.school}</td>
                  <td>{e.count}</td>
                  <td>
                    <StatusBadge status={e.status as any} />
                  </td>
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
          HakwonPlus · Biology Exam Operations Console
        </div>
      </div>
    </DomainLayout>
  );
}
