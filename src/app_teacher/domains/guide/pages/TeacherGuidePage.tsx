import { useNavigate } from "react-router";
import { setPreferFullWorkspace } from "@/core/router/MobileWorkspaceRedirect";
import { ICON } from "@/shared/ui/ds";
import { CheckCircle, ChevronRight, Monitor } from "@teacher/shared/ui/Icons";
import styles from "./TeacherGuidePage.module.css";

type JourneyStep = {
  title: string;
  place: string;
  action: string;
  result: string;
  path: string;
  mode: "mobile" | "desktop";
};

const JOURNEY: JourneyStep[] = [
  {
    title: "학생 추가",
    place: "학생 → 추가",
    action: "학생 이름과 학부모 전화번호, 초기 비밀번호를 입력하고 최종 확인에서 실제 로그인 ID를 확인합니다.",
    result: "학생 목록에서 다시 검색해 등록 여부를 확인합니다. 명부 등록만으로 계정 안내가 발송되지는 않습니다.",
    path: "/workspace/mobile/students",
    mode: "mobile",
  },
  {
    title: "강의 개설",
    place: "강의 → 강의 추가",
    action: "강의명, 강사, 과목, 수업 시간을 입력하고 생성합니다.",
    result: "강의 목록에 새 강의가 보이는지 확인합니다.",
    path: "/workspace/mobile/classes",
    mode: "mobile",
  },
  {
    title: "차시 생성",
    place: "강의 → 강의 선택 → 차시 → 차시 추가",
    action: "수업 날짜와 시간을 확인해 차시를 저장합니다. 강의만 만들면 차시는 자동으로 생기지 않습니다.",
    result: "강의의 차시 목록에서 날짜와 회차를 다시 확인합니다.",
    path: "/workspace/mobile/classes",
    mode: "mobile",
  },
  {
    title: "수강생 등록",
    place: "강의 → 강의 선택 → 수강생 → 수강생 등록",
    action: "이미 학생 명부에 등록된 학생을 검색·선택하고 등록합니다. 명부에 없는 학생은 먼저 학생 화면에서 추가합니다.",
    result: "수강생 목록과 해당 차시의 출결 대상에 학생이 보이는지 확인합니다. 첫 수강 확정 시 계정 안내 발송 결과도 확인합니다.",
    path: "/workspace/mobile/classes",
    mode: "mobile",
  },
  {
    title: "시험 등록",
    place: "PC 버전 → 강의 → 차시 → 성적 → 시험 추가",
    action: "시험 설정해서 만들기를 선택하고 시험명·만점·채점 방식을 정합니다. 답안 등록과 OMR 답안지 준비가 이어집니다.",
    result: "같은 차시의 시험·성적 화면과 모바일 시험 목록에 저장된 시험이 보이는지 확인합니다.",
    path: "/workspace/lectures",
    mode: "desktop",
  },
  {
    title: "과제 등록과 배정",
    place: "PC 버전 → 강의 → 차시 → 성적 도구 → 과제 추가",
    action: "과제 내용과 제출 조건을 저장하고, 해당 차시의 대상 수강생을 확인합니다.",
    result: "차시의 과제 탭과 모바일 시험·과제 목록에서 제출 대상과 마감일을 확인합니다.",
    path: "/workspace/lectures",
    mode: "desktop",
  },
  {
    title: "클리닉 운영",
    place: "클리닉 → 날짜·세션 선택 → 참가자 추가",
    action: "필요한 날짜에 클리닉 세션을 만들거나 열고 대상 학생을 배정합니다. 출석·진행 상태는 실제 참석에 맞춰 기록합니다.",
    result: "세션 참가자 목록과 학생 상세의 클리닉 이력에서 반영 상태를 확인합니다.",
    path: "/workspace/mobile/clinic",
    mode: "mobile",
  },
  {
    title: "영상 등록과 시청 확인",
    place: "영상 → 파일 업로드 또는 링크 추가",
    action: "영상을 올리고 연결할 강의·차시와 학생에게 보일 순서를 확인합니다. 파일은 업로드 후 인코딩이 끝나야 재생할 수 있습니다.",
    result: "영상 상태가 완료인지 확인하고 해당 차시 수강생 화면에서 재생 가능 여부를 확인합니다. 실패 상태라면 재시도합니다.",
    path: "/workspace/mobile/videos",
    mode: "mobile",
  },
];

export default function TeacherGuidePage() {
  const navigate = useNavigate();

  const openStep = (step: JourneyStep) => {
    if (step.mode === "desktop") setPreferFullWorkspace(true);
    navigate(step.path);
  };

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>선생님 실전 가이드</p>
        <h1 className={styles.title}>첫 수업까지, 순서대로 따라하세요.</h1>
        <p className={styles.description}>
          학생을 명부에 추가한 다음 강의·차시·수강생을 연결합니다. 그 뒤 시험, 과제,
          클리닉, 영상을 해당 수업에 붙이세요. 각 단계에서 저장 결과까지 확인할 수 있습니다.
        </p>
      </header>

      <div className={styles.startBox}>
        <CheckCircle size={ICON.md} aria-hidden />
        <div>
          <strong>휴대폰에서도 두 화면을 사용할 수 있습니다.</strong>
          <span>학생·강의·차시·수강생·클리닉·영상은 모바일 화면에서 진행합니다. 시험과 과제 생성은 아래 버튼이 PC 버전의 실제 업무 화면으로 연결합니다.</span>
        </div>
      </div>

      <section aria-labelledby="teacher-guide-journey-title" className={styles.journey}>
        <div className={styles.sectionHeading}>
          <span className={styles.sectionEyebrow}>01 — 수업 준비와 운영</span>
          <h2 id="teacher-guide-journey-title">실제 작업 순서</h2>
        </div>
        <div className={styles.list}>
          {JOURNEY.map((step, index) => (
            <details key={step.title} className={styles.item}>
              <summary className={styles.itemSummary}>
                <span className={styles.stepNumber}>{String(index + 1).padStart(2, "0")}</span>
                <span className={styles.itemCopy}>
                  <strong>{step.title}</strong>
                  <span>{step.place}</span>
                </span>
                <span className={styles.modeLabel}>{step.mode === "mobile" ? "모바일" : "PC 화면"}</span>
                <ChevronRight size={ICON.sm} className={styles.chevron} aria-hidden />
              </summary>
              <div className={styles.itemBody}>
                <p>{step.action}</p>
                <div className={styles.result}><strong>완료 확인</strong><span>{step.result}</span></div>
                <button type="button" className={styles.openButton} onClick={() => openStep(step)}>
                  {step.mode === "desktop" ? "PC 화면에서 시작" : "모바일 화면에서 시작"}
                  <ChevronRight size={ICON.sm} aria-hidden />
                </button>
              </div>
            </details>
          ))}
        </div>
      </section>

      <section className={styles.helpBox} aria-labelledby="teacher-guide-help-title">
        <h2 id="teacher-guide-help-title">막혔을 때 먼저 확인</h2>
        <ul>
          <li>학생이 수업에 안 보이면 학생 명부 등록 후 해당 강의의 수강생 등록을 확인하세요.</li>
          <li>모바일 시험·과제 목록에서 새 항목을 만들 수 없으면 위의 PC 화면 버튼으로 해당 강의의 차시를 여세요.</li>
          <li>영상 파일은 업로드 완료와 시청 가능 상태가 다릅니다. 처리 완료 또는 실패 상태를 확인하세요.</li>
        </ul>
        <button type="button" className={styles.desktopGuideButton} onClick={() => { setPreferFullWorkspace(true); navigate("/workspace/guide"); }}>
          <Monitor size={ICON.sm} aria-hidden /> PC 버전 전체 가이드 보기
          <ChevronRight size={ICON.sm} aria-hidden />
        </button>
      </section>
    </div>
  );
}
