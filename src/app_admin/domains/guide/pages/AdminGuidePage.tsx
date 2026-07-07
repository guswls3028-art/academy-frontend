/**
 * 선생앱(관리자) 공식 사용 가이드 — 계약 직후 온보딩 + 업무 흐름 + 투어
 */
import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2, ChevronDown, CircleAlert, KeyRound, Play } from "lucide-react";
import { DomainLayout } from "@/shared/ui/layout";
import { useGuideTour } from "@/shared/ui/guide";
import type { GuideWorkflow } from "@/shared/ui/guide";
import { ADMIN_WORKFLOWS } from "../data/adminWorkflows";
import styles from "./AdminGuidePage.module.css";

type StartItem = {
  label: string;
  title: string;
  description: string;
  path?: string;
  action?: string;
};

type FindingItem = {
  title: string;
  risk: string;
  resolution: string;
};

const START_ITEMS: StartItem[] = [
  {
    label: "1",
    title: "학원 정보와 공개 고지부터 확인",
    description: "로고, 학원명, 대표자, 사업자 정보, 개인정보 담당자, 상담 연락처를 먼저 채워 주세요.",
    path: "/admin/settings/organization",
    action: "학원 정보",
  },
  {
    label: "2",
    title: "선생님·조교 계정과 권한 정리",
    description: "직원이 직접 처리할 업무를 기준으로 계정을 만들고, 대표/관리자 권한은 필요한 사람에게만 줍니다.",
    path: "/admin/staff",
    action: "직원 관리",
  },
  {
    label: "3",
    title: "학생 1명으로 시범 운영",
    description: "전체 학생을 넣기 전에 테스트 학생을 등록해 로그인, 강의 배정, 알림톡 수신 흐름을 확인합니다.",
    path: "/admin/students",
    action: "학생 관리",
  },
  {
    label: "4",
    title: "강의와 차시를 먼저 만들기",
    description: "학생에게 시험, 영상, 출결, 과제를 붙이려면 강의와 차시가 기준점이 됩니다.",
    path: "/admin/lectures",
    action: "강의 관리",
  },
  {
    label: "5",
    title: "알림톡 설정과 발송 내역 확인",
    description: "템플릿, 발신 상태, 실패 내역을 먼저 확인하면 학부모 안내 전에 불안이 줄어듭니다.",
    path: "/admin/message/settings",
    action: "메시지 설정",
  },
];

const FIRST_USE_FINDINGS: FindingItem[] = [
  {
    title: "로그인 기준이 역할마다 달라 처음에 헷갈릴 수 있음",
    risk: "대표·선생님은 발급받은 아이디, 학생은 학생 아이디, 학부모는 등록된 휴대폰 번호를 씁니다.",
    resolution: "계약 안내 시 역할별 로그인 기준을 한 줄로 같이 전달하고, 첫날에는 학생 1명과 학부모 번호로 직접 확인합니다.",
  },
  {
    title: "빈 화면이 오류처럼 보일 수 있음",
    risk: "학생, 강의, 차시가 없으면 시험·영상·성적·알림톡 화면도 비어 보입니다.",
    resolution: "처음에는 학생 등록 → 강의 생성 → 차시 추가 → 수강생 배정 순서로 최소 데이터를 먼저 만듭니다.",
  },
  {
    title: "PC와 모바일에서 해야 할 일이 섞일 수 있음",
    risk: "모바일은 현장 처리에 강하고, 대량 등록·시험지·영상·설정은 PC가 더 안정적입니다.",
    resolution: "대표는 PC에서 초기 세팅을 마치고, 선생님은 모바일에서 오늘 수업·출결·알림을 처리하도록 안내합니다.",
  },
  {
    title: "학생 회원가입 신청 후 승인 흐름을 놓칠 수 있음",
    risk: "학생이 신청했는데 선생님이 승인하지 않으면 학생은 계속 로그인하지 못했다고 느낍니다.",
    resolution: "학생 관리에서 가입 신청/등록 상태를 확인하고, 실제 수업 전에 승인 여부를 점검합니다.",
  },
  {
    title: "알림톡 발송 전 수신 대상과 실패 처리 기준이 불안할 수 있음",
    risk: "처음 발송 때 잘못 보낼까 봐 업무가 멈추거나, 실패 내역을 어디서 보는지 모를 수 있습니다.",
    resolution: "소수 테스트 대상으로 발송 흐름을 확인하고, 발송 내역에서 성공/실패 필터로 결과를 봅니다.",
  },
  {
    title: "법적 고지 정보가 비어 있으면 신뢰도가 떨어질 수 있음",
    risk: "약관, 개인정보처리방침, 공개 페이지에 표시될 정보가 비어 있으면 외부 고객에게 미완성처럼 보입니다.",
    resolution: "대표 계정으로 학원 정보와 개인정보 담당자 연락처를 먼저 채운 뒤 학생·학부모에게 안내합니다.",
  },
];

function StartRow({ item }: { item: StartItem }) {
  const navigate = useNavigate();
  const isClickable = Boolean(item.path);

  const content = (
    <>
      <span className={styles.startIndex}>{item.label}</span>
      <span className={styles.startCopy}>
        <strong>{item.title}</strong>
        <span>{item.description}</span>
      </span>
      {item.action ? (
        <span className={styles.startAction}>
          {item.action}
          <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true" />
        </span>
      ) : null}
    </>
  );

  if (!isClickable) {
    return <div className={styles.startRow}>{content}</div>;
  }

  return (
    <button
      type="button"
      className={styles.startRow}
      onClick={() => navigate(item.path!)}
    >
      {content}
    </button>
  );
}

function FindingDetails({ item, index }: { item: FindingItem; index: number }) {
  return (
    <details className={styles.finding}>
      <summary>
        <span className={styles.findingNumber}>{index + 1}</span>
        <span className={styles.findingSummary}>
          <strong>{item.title}</strong>
          <span>{item.risk}</span>
        </span>
        <ChevronDown size={18} aria-hidden="true" />
      </summary>
      <p>
        <CheckCircle2 size={15} aria-hidden="true" />
        <span>{item.resolution}</span>
      </p>
    </details>
  );
}

/* ================================================================
   워크플로우 카드 (아코디언)
   ================================================================ */
function WorkflowCard({
  wf,
  open,
  onToggle,
}: {
  wf: GuideWorkflow;
  open: boolean;
  onToggle: () => void;
}) {
  const navigate = useNavigate();
  const { startTour } = useGuideTour();

  const handleTour = useCallback(() => {
    if (!wf.tourPath || !wf.tourSteps?.length) return;
    startTour({ steps: wf.tourSteps });
    navigate(wf.tourPath);
  }, [wf, startTour, navigate]);

  return (
    <div className={`${styles.card} ${open ? styles.cardOpen : ""}`}>
      {/* 헤더 — 클릭으로 펼침/접힘. 우측 「시작」 버튼은 stopPropagation으로 분리 */}
      <div
        className={styles.cardHeader}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-label={`${wf.title} 카드 ${open ? "접기" : "펼치기"}`}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        <div className={styles.iconBox}>
          {wf.icon}
        </div>
        <div className={styles.headerText}>
          <div className={styles.cardTitle}>{wf.title}</div>
          <div className={styles.cardSummary}>
            {wf.summary}
          </div>
        </div>
        {wf.tourPath && wf.tourSteps?.length ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleTour();
            }}
            aria-label={`${wf.title} 투어 시작`}
            className={styles.startButton}
          >
            <Play size={11} fill="currentColor" aria-hidden="true" />
            시작
          </button>
        ) : null}
        <ChevronDown
          size={20}
          aria-hidden="true"
          className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`}
        />
      </div>

      {/* 아코디언 본문 — grid-template-rows 트랜지션 */}
      <div className={`${styles.contentGrid} ${open ? styles.contentGridOpen : ""}`}>
        <div className={styles.contentClip}>
          <div className={styles.contentInner}>
            {/* 단계 목록 */}
            <div className={styles.stepList}>
              {wf.steps.map((step, i) => (
                <div key={i} className={styles.stepItem}>
                  {/* 번호 원 + 연결선 */}
                  <div className={styles.stepRail}>
                    <div className={styles.stepNumber}>
                      {i + 1}
                    </div>
                    {i < wf.steps.length - 1 && (
                      <div className={styles.stepConnector} />
                    )}
                  </div>
                  <div className={styles.stepBody}>
                    <div className={styles.stepTitle}>
                      {step.title}
                    </div>
                    <div className={styles.stepDescription}>
                      {step.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 직접 해보기 버튼 */}
            {wf.tourPath && wf.tourSteps?.length ? (
              <button
                type="button"
                onClick={handleTour}
                className={styles.tryButton}
              >
                직접 해보기
                <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   페이지
   ================================================================ */
export default function AdminGuidePage() {
  const [openId, setOpenId] = useState<string | null>(null);

  const toggle = useCallback(
    (id: string) => setOpenId((prev) => (prev === id ? null : id)),
    [],
  );

  return (
    <DomainLayout
      title="공식 사용 가이드"
      description="계약 직후 대표와 선생님이 그대로 따라갈 수 있는 시작 순서입니다. 로그인 화면은 심플하게 두고, 자세한 안내는 여기에서 확인합니다."
    >
      <div className={styles.guidePage}>
        <section className={styles.heroPanel} aria-labelledby="official-guide-title">
          <div className={styles.heroCopy}>
            <p className={styles.kicker}>Official onboarding</p>
            <h2 id="official-guide-title">처음 하루는 이 순서만 따라오세요.</h2>
            <p>
              모든 기능을 한 번에 익히려고 하면 복잡합니다. 먼저 대표가 기본 정보를 채우고,
              학생 1명으로 실제 로그인과 발송 흐름을 확인한 뒤 전체 운영으로 넓혀 가세요.
            </p>
          </div>
          <div className={styles.heroGoal}>
            <KeyRound size={18} aria-hidden="true" />
            <span>첫날 목표</span>
            <strong>학생 1명 등록 → 강의 배정 → 로그인 확인 → 알림톡 준비</strong>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="start-order-title">
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.sectionKicker}>Start order</p>
              <h2 id="start-order-title">계약 직후 체크리스트</h2>
            </div>
            <span className={styles.sectionHint}>대표 계정으로 먼저 확인</span>
          </div>
          <div className={styles.startList}>
            {START_ITEMS.map((item) => (
              <StartRow key={item.label} item={item} />
            ))}
          </div>
        </section>

        <section className={styles.section} aria-labelledby="first-use-findings-title">
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.sectionKicker}>First-use review</p>
              <h2 id="first-use-findings-title">처음 막히기 쉬운 지점</h2>
            </div>
            <span className={styles.sectionHint}>
              <CircleAlert size={14} aria-hidden="true" />
              안내할 때 함께 확인
            </span>
          </div>
          <div className={styles.findingList}>
            {FIRST_USE_FINDINGS.map((item, index) => (
              <FindingDetails key={item.title} item={item} index={index} />
            ))}
          </div>
        </section>

        <section className={styles.section} aria-labelledby="workflow-title">
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.sectionKicker}>Workflow</p>
              <h2 id="workflow-title">업무별 따라하기</h2>
            </div>
            <span className={styles.sectionHint}>카드를 눌러 상세 단계 보기</span>
          </div>
          <div className={styles.workflowList}>
            {ADMIN_WORKFLOWS.map((wf) => (
              <WorkflowCard
                key={wf.id}
                wf={wf}
                open={openId === wf.id}
                onToggle={() => toggle(wf.id)}
              />
            ))}
          </div>
        </section>
      </div>
    </DomainLayout>
  );
}
