import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowRight,
  Camera,
  Check,
  Download,
  FileImage,
  FolderOpen,
  MousePointer2,
  Presentation,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";
import PhoneInquiryLink from "../components/PhoneInquiryLink";
import styles from "./MatchupPptPage.module.css";

const GUIDE_STEPS = [
  {
    number: "01",
    label: "CAPTURE",
    icon: Camera,
    title: "시험지를 학교·시험별로 올립니다",
    body: "휴대폰으로 찍은 문제 이미지나 받은 PDF를 그대로 시작점으로 씁니다. 개포고, 단대부고, 숙명여고처럼 학교별 폴더를 만들고 시험명을 붙이면 다음 수업에서도 다시 찾기 쉽습니다.",
    points: [
      "JPG·PNG 이미지와 PDF 자료 업로드",
      "학교·학기·시험 범위별 자료 정리",
      "문항 이미지를 원문 그대로 확인",
    ],
    image: "/promo/matchup-gaepo-results-20260725.png",
    alt: "개포고 파이널 모의고사를 학교와 시험 폴더별로 정리한 학원플러스 매치업 화면",
    caption: "제품 실화면 · 개포고 데모 데이터",
  },
  {
    number: "02",
    label: "MATCH",
    icon: ScanSearch,
    title: "원문 옆에서 유사문제 후보를 비교합니다",
    body: "한 문항씩 원문과 후보를 나란히 봅니다. 유사도 점수는 빠르게 살펴볼 순서를 정하는 참고값이고, 최종 선택은 선생님이 풀이 구조와 수업 목적을 보고 결정합니다.",
    points: [
      "원문과 후보 문제를 한 화면에서 비교",
      "유사도·출처를 보고 확인할 순서 판단",
      "별표로 수업에 쓸 후보를 직접 선택",
    ],
    image: "/promo/matchup-gaepo-candidates-20260725.png",
    alt: "개포고 문제와 85퍼센트 및 86퍼센트 유사문제 후보를 비교하는 실제 제품 화면",
    caption: "유사도는 후보 점수 · 최종 선택은 선생님",
  },
  {
    number: "03",
    label: "BUILD",
    icon: Presentation,
    title: "고른 문제를 PPT 슬라이드로 이어서 구성합니다",
    body: "선택한 문제 이미지를 다시 캡처해 파워포인트에 붙이지 않아도 됩니다. 슬라이드 순서를 보고 화면 비율, 배경, 이미지 맞춤 방식을 수업 환경에 맞게 정합니다.",
    points: [
      "문제별 슬라이드 썸네일과 순서 확인",
      "16:9·4:3 화면 비율 선택",
      "검정·흰색 배경과 맞춤·채우기 설정",
    ],
    image: "/promo/ppt-gaepo-setup-20260725.png",
    alt: "개포고 문제 두 장을 16대 9 파워포인트 슬라이드로 구성하는 학원플러스 PPT 생성 화면",
    caption: "실제 업로드 화면 · 2장 슬라이드 예시",
  },
  {
    number: "04",
    label: "TEACH",
    icon: Download,
    title: "미리보고 내려받아 바로 수업에 씁니다",
    body: "프로젝터에 보일 문제 크기와 여백을 미리 확인한 다음 PPT 파일을 생성합니다. 페이지 수와 이미지 용량에 따라 처리 시간은 달라질 수 있습니다.",
    points: [
      "슬라이드 결과를 생성 전에 미리보기",
      "페이지 수·용량·화면 비율 최종 확인",
      "PPT 파일 다운로드 후 수업에 사용",
    ],
    image: "/promo/ppt-gaepo-ready-20260725.png",
    alt: "개포고 문제 슬라이드를 미리보고 PPT 생성 및 다운로드 버튼을 확인하는 실제 제품 화면",
    caption: "2장 · 16:9 · 검정 배경 데모",
    focus: "right",
  },
];

const CLASS_PREP_EXAMPLE = [
  {
    time: "자료 받는 날",
    title: "학교 시험지 촬영",
    body: "교무실이나 조교가 받은 시험지를 학교 폴더에 올립니다.",
  },
  {
    time: "해설 준비",
    title: "문항별 후보 확인",
    body: "매치업 후보를 비교하고 해설 수업에 쓸 문제만 별표로 고릅니다.",
  },
  {
    time: "수업 직전",
    title: "PPT 순서 확정",
    body: "문제 순서와 화면 비율을 확인해 강의실용 PPT로 내려받습니다.",
  },
];

function ProductBar({ label }: { label: string }) {
  return (
    <div className={styles.productBar}>
      <span aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <strong>{label}</strong>
      <em>hakwonplus</em>
    </div>
  );
}

export default function MatchupPptPage() {
  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="matchup-ppt-page-title">
        <div className={styles.heroGrid}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>
              <Sparkles size={16} />
              대치 수업자료 제작 가이드
            </span>
            <h1 id="matchup-ppt-page-title">
              시험지를 찍으면,
              <br />
              <em>매치업부터 PPT까지</em>
            </h1>
            <p>
              개포고 시험지로 직접 데이터를 채운 제품 화면입니다. 원문을 올리고, 유사문제 후보를 선생님이
              확인하고, 선택한 문제를 수업용 PPT로 만드는 흐름을 그대로 보여드립니다.
            </p>
            <div className={styles.heroActions}>
              <Link to="/promo/demo" className={styles.primaryButton}>
                내 자료로 데모 요청
                <MousePointer2 size={18} />
              </Link>
              <PhoneInquiryLink className={styles.secondaryButton}>
                전화로 도입 문의
              </PhoneInquiryLink>
            </div>
            <ul className={styles.heroFacts}>
              <li>
                <Check size={15} />
                JPG·PNG·PDF
              </li>
              <li>
                <Check size={15} />
                후보 비교
              </li>
              <li>
                <Check size={15} />
                16:9 PPT
              </li>
            </ul>
          </div>

          <div className={styles.heroVisual}>
            <figure className={styles.heroFrame}>
              <ProductBar label="유사문제 매치업 · 개포고" />
              <img
                src="/promo/matchup-gaepo-results-20260725.png"
                alt="개포고 파이널 모의고사와 유사문제 결과를 함께 보여주는 학원플러스 실제 화면"
              />
            </figure>
            <div className={styles.heroTicket}>
              <span>REAL PRODUCT</span>
              <strong>제품 실화면</strong>
              <p>개포고 데모 데이터로 직접 캡처</p>
            </div>
            <div className={styles.heroPptCard}>
              <Presentation size={23} />
              <span>선택한 문제</span>
              <strong>16:9 수업 PPT</strong>
              <ArrowRight size={17} />
            </div>
          </div>
        </div>

        <a href="#guide" className={styles.scrollCue}>
          네 단계로 따라보기
          <ArrowDown size={17} />
        </a>
      </section>

      <section className={styles.routeSection} aria-label="매치업 PPT 제작 순서">
        <div className={styles.sectionWrap}>
          <ol className={styles.routeList}>
            {[
              { icon: Camera, title: "찍기", desc: "시험지·문제 이미지" },
              { icon: ScanSearch, title: "찾기", desc: "유사문제 후보" },
              { icon: Star, title: "고르기", desc: "선생님 최종 확인" },
              { icon: Presentation, title: "PPT", desc: "16:9 수업자료" },
            ].map((item, index) => {
              const Icon = item.icon;
              return (
                <li key={item.title}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <Icon size={22} />
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.desc}</p>
                  </div>
                  {index < 3 ? <ArrowRight className={styles.routeArrow} size={17} aria-hidden="true" /> : null}
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section id="guide" className={styles.guideSection} aria-labelledby="guide-title">
        <div className={styles.sectionWrap}>
          <header className={styles.sectionHead}>
            <span>FEATURE GUIDE</span>
            <h2 id="guide-title">화면을 보면서 그대로 따라갑니다</h2>
            <p>
              설명용 목업이 아니라 실제 학원플러스 관리자에서 업로드하고 확인한 화면입니다.
              어떤 버튼과 정보가 다음 단계로 이어지는지 기능별로 풀었습니다.
            </p>
          </header>

          <div className={styles.guideStack}>
            {GUIDE_STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <article key={step.number} className={styles.guideCard} data-side={index % 2 === 0 ? "left" : "right"}>
                  <div className={styles.guideCopy}>
                    <div className={styles.guideIndex}>
                      <span>{step.number}</span>
                      <em>{step.label}</em>
                      <Icon size={22} />
                    </div>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                    <ul>
                      {step.points.map((point) => (
                        <li key={point}>
                          <Check size={16} />
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <figure className={styles.guideVisual} data-focus={"focus" in step ? step.focus : undefined}>
                    <ProductBar label={`${step.number} · ${step.label}`} />
                    <img src={step.image} alt={step.alt} loading="lazy" />
                    <figcaption>{step.caption}</figcaption>
                  </figure>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className={styles.guardrailSection} aria-labelledby="guardrail-title">
        <div className={styles.sectionWrap}>
          <div className={styles.guardrailCard}>
            <div className={styles.guardrailIcon}>
              <ShieldCheck size={31} />
            </div>
            <div>
              <span>MATCH SCORE, NOT AN ANSWER</span>
              <h2 id="guardrail-title">매치업 점수는 답이 아니라, 확인할 후보입니다</h2>
            </div>
            <p>
              화면의 85%·86%는 유사문제 후보를 살펴볼 순서를 돕는 점수입니다.
              실제 수업에 넣을지는 선생님이 원문, 풀이 구조, 난이도를 직접 보고 결정합니다.
            </p>
          </div>
        </div>
      </section>

      <section className={styles.exampleSection} aria-labelledby="class-example-title">
        <div className={styles.sectionWrap}>
          <div className={styles.exampleHead}>
            <span>DAECHI CLASS PREP</span>
            <h2 id="class-example-title">대치 수업 준비에 넣으면 이런 순서입니다</h2>
            <p>아래는 개포고 내신 해설 수업을 준비하는 사용 예시입니다. 실제 운영 방식에 맞춰 단계를 나눌 수 있습니다.</p>
          </div>
          <div className={styles.exampleGrid}>
            {CLASS_PREP_EXAMPLE.map((item, index) => (
              <article key={item.time}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <em>{item.time}</em>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
          <div className={styles.fileRibbon}>
            <FileImage size={22} />
            <div>
              <span>INPUT</span>
              <strong>학교 시험지</strong>
            </div>
            <ArrowRight size={18} />
            <FolderOpen size={22} />
            <div>
              <span>WORKSPACE</span>
              <strong>매치업 후보</strong>
            </div>
            <ArrowRight size={18} />
            <Presentation size={22} />
            <div>
              <span>OUTPUT</span>
              <strong>수업용 PPT</strong>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.finalCta} aria-labelledby="matchup-final-title">
        <div className={styles.sectionWrap}>
          <div className={styles.finalCtaInner}>
            <span>YOUR MATERIAL, YOUR CLASS</span>
            <h2 id="matchup-final-title">선생님 자료 한 묶음으로 직접 확인해 보세요</h2>
            <p>학교 시험지나 문제 이미지가 있다면, 매치업 후보 확인부터 PPT 구성까지 실제 흐름으로 보여드립니다.</p>
            <div>
              <Link to="/promo/demo" className={styles.primaryButton}>
                데모 요청
                <ArrowRight size={18} />
              </Link>
              <Link to="/promo/features" className={styles.secondaryButton}>
                전체 기능 보기
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
