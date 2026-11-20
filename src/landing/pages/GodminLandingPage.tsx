import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router";

import { setLandingMeta } from "@/landing/utils/seoMeta";
import { GodminHeroVideo, VideoHighlights } from "@/landing/components/VideoCards";

import { GodminSiteHeader, GodminSiteFooter } from "../components/GodminSiteChrome";
import { GODMIN_PUBLIC_SITE } from "@/shared/tenant/tenants/godmin";
import styles from "./GodminLandingPage.module.css";

const CREDENTIALS = [
  { kicker: "Online", value: "대성마이맥 통합과학" },
  { kicker: "Daechi-dong", value: "대치동 현장 강의" },
  { kicker: "Academy", value: "두각학원 출강" },
  { kicker: "On air", value: "MBC 「구해줘! 홈즈」 출연" },
];

const DISCIPLINES = [
  { code: "01", name: "물리", en: "Physics", note: "힘과 에너지, 운동의 관계를 그림 한 장으로 읽어냅니다." },
  { code: "02", name: "화학", en: "Chemistry", note: "보이지 않는 입자의 움직임에서 반응의 이유를 찾습니다." },
  { code: "03", name: "생명", en: "Life Science", note: "구조가 기능을 만드는 까닭을 하나의 흐름으로 이해합니다." },
  { code: "04", name: "지구", en: "Earth Science", note: "긴 시간과 넓은 공간의 변화를 하나의 맥락으로 봅니다." },
];

const LEARNING_STEPS = [
  {
    label: "Understand",
    title: "개념을 구조로 이해합니다",
    description: "단편적인 암기 대신, 현상이 왜 일어나는지와 앞뒤 개념이 어떻게 이어지는지부터 설명합니다.",
  },
  {
    label: "Apply",
    title: "문제에서 연결을 확인합니다",
    description: "자체 교재와 주차별 자료로 배운 원리를 문제에 적용하며, 낯선 표현 앞에서도 흔들리지 않는 기준을 세웁니다.",
  },
  {
    label: "Review",
    title: "테스트와 클리닉으로 남깁니다",
    description: "숙제와 주차별 테스트 결과를 확인하고, 연구실 클리닉에서 막혔던 지점을 다시 짚습니다.",
  },
];

const INTERVIEW_URL = "https://m.lemouton.co.kr/article/%EB%A5%B4%EB%AC%B4%ED%86%B5-%EC%97%A0%EB%B2%84%EC%84%9C%EB%8D%94/18/78433/";

const PROFILE_LINKS = [
  {
    label: "두각 공식 강사 소개",
    date: "공식 강사진",
    detail: "통합과학·화학 담당과 대성마이맥 강의 이력",
    href: "https://dugak.net/info/teacher.do",
  },
  {
    label: "명인학원 수업 안내",
    date: "강좌 안내 · 2026.06.14",
    detail: "교재·주차별 테스트·연구실 클리닉으로 이어지는 수업 구성",
    href: "https://mp.myunginedu.co.kr/branch/classinfo_detail.php?a_serial=4208&mode=read&page=4",
  },
  {
    label: "MBC 구해줘! 홈즈",
    date: "iMBC 보도 · 2025.04.16",
    detail: "보도 당시 13년 차 강사로 소개된 신민T와 대치동 연구실",
    href: "https://enews.imbc.com/News/RetrieveNewsInfo/457287",
  },
  {
    label: "르무통 인터뷰",
    date: "브랜드 인터뷰 · 2023.10.10",
    detail: "화학교육 전공과 무대 경험, 학생과 교감하는 강의 이야기",
    href: INTERVIEW_URL,
  },
];

const INSTAGRAM_URL = "https://www.instagram.com/godmin7/";

const ENROLLMENT_LINKS = [
  {
    academy: "두각학원",
    description: "고1 학교별 내신반 · 강좌 선택 후 신청",
    url: "https://www.dugak.net/time/?tid=43&mid=427",
  },
];

export default function GodminLandingPage() {
  const { hash, key } = useLocation();
  const [heroReady, setHeroReady] = useState(false);
  const [highlightsReady, setHighlightsReady] = useState(false);
  const handleHeroReady = useCallback(() => setHeroReady(true), []);
  const handleHighlightsReady = useCallback(() => setHighlightsReady(true), []);
  useEffect(() => {
    if (hash && heroReady && highlightsReady) document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [hash, key, heroReady, highlightsReady]);
  useEffect(() => {
    const { title, description, name, origin } = GODMIN_PUBLIC_SITE;
    const pageUrl = `${origin}/landing`;
    const ogImage = new URL("/tenants/godmin/og-image.png", window.location.origin).toString();

    document.title = title;
    setLandingMeta("description", description);
    setLandingMeta("og:title", title);
    setLandingMeta("og:description", description);
    setLandingMeta("og:type", "website");
    document.querySelector('link[rel="canonical"]')?.setAttribute("href", pageUrl);
    setLandingMeta("og:url", pageUrl);
    setLandingMeta("og:site_name", name);
    setLandingMeta("og:image", ogImage);
    setLandingMeta("twitter:card", "summary_large_image");
    setLandingMeta("twitter:title", title);
    setLandingMeta("twitter:description", description);
    setLandingMeta("twitter:image", ogImage);

    return () => { document.title = "신과함께"; };
  }, []);

  return (
    <div className={styles.page}>
      <GodminSiteHeader />

      <main>
        <section className={styles.hero} aria-labelledby="godmin-hero-title">
          <div className={styles.heroBackdrop} aria-hidden="true"><span /><span /></div>
          <div className={styles.heroCopy}>
            <div className={styles.eyebrow}>
              <span />
              {GODMIN_PUBLIC_SITE.name} · 대치동 통합과학
            </div>
            <h1 id="godmin-hero-title">
              복잡한 과학을,
              <strong>이해되는 구조로.</strong>
            </h1>
            <p>
              물리·화학·생명·지구과학을 따로 외우지 않습니다.
              흩어진 개념을 하나의 원리로 잇고, 문제로 확인하고, 끝까지 관리합니다.
            </p>
            <div className={styles.heroActions}>
              <Link className={styles.primaryAction} to="/login/godmin">
                수강생·학부모 로그인
                <span className={styles.actionIcon}><ArrowIcon /></span>
              </Link>
              {ENROLLMENT_LINKS.length > 0 && (
                <details className={styles.enrollment}>
                  <summary className={styles.secondaryAction}>수강신청 바로가기</summary>
                  <div className={styles.enrollmentPanel}>
                    <p>학원을 선택하면 신청 페이지가 새 탭에서 열립니다.</p>
                    <ul>
                      {ENROLLMENT_LINKS.map(({ academy, description, url }) => (
                        <li key={url}>
                          <a href={url} target="_blank" rel="noopener noreferrer">
                            <span><strong>{academy}</strong><small>{description}</small></span>
                            <span aria-hidden="true">↗</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                </details>
              )}
            </div>
            <div className={styles.heroLinks}>
              <a href="#philosophy">수업 방식 보기<ArrowIcon /></a>
              <Link to="/landing/resources">매치업 · 분석자료<ArrowIcon /></Link>
            </div>
          </div>

          <div className={styles.heroMedia}>
            <GodminHeroVideo onReady={handleHeroReady} fallback={<div className={styles.heroVisual} aria-label="신민 통합과학 강사 프로필">
              <div className={styles.orbitField} aria-hidden="true">
                <span className={styles.orbitOne} />
                <span className={styles.orbitTwo} />
                <span className={styles.orbitThree} />
                <i className={styles.orbitDotOne} />
                <i className={styles.orbitDotTwo} />
              </div>
              <div className={styles.portraitFrame}>
                <img
                  src="/tenants/godmin/landing-portrait.webp"
                  alt="통합과학 강사 신민 선생님"
                  fetchPriority="high"
                />
              </div>
              <div className={`${styles.subjectTag} ${styles.subjectPhysics}`}>물리</div>
              <div className={`${styles.subjectTag} ${styles.subjectChemistry}`}>화학</div>
              <div className={`${styles.subjectTag} ${styles.subjectBiology}`}>생명</div>
              <div className={`${styles.subjectTag} ${styles.subjectEarth}`}>지구</div>
              <div className={styles.visualCaption}>
                <span>Integrated Science</span>
                <strong>신민T</strong>
              </div>
            </div>} />
          </div>
        </section>

        <section className={styles.signalBar} aria-label="신민 선생님 공개 프로필 요약">
          <ul>
            {CREDENTIALS.map(({ kicker, value }) => (
              <li key={value}>
                <span aria-hidden="true">{kicker}</span>
                <strong>{value}</strong>
              </li>
            ))}
          </ul>
        </section>

        <VideoHighlights onReady={handleHighlightsReady} />

        <section id="philosophy" className={styles.philosophy} aria-labelledby="philosophy-title">
          <div className={`${styles.sectionLead} ${styles.reveal}`}>
            <span className={styles.sectionLabel}>One Science Map</span>
            <h2 id="philosophy-title">네 영역을 잇는<br />{" "}하나의 과학 지도</h2>
            <p>
              통합과학은 넓지만, 흩어져 있지 않습니다. 영역마다 핵심 원리를 붙잡고
              서로 맞닿는 지점을 이해하면, 처음 보는 문제도 읽어낼 기준이 생깁니다.
            </p>
          </div>
          <div className={styles.disciplineMap}>
            <div className={styles.mapCore} aria-hidden="true">
              <span>Min.T</span>
              <strong>통합</strong>
            </div>
            {DISCIPLINES.map((item) => (
              <article className={styles.disciplineCard} key={item.code}>
                <div className={styles.disciplineMeta}>
                  <span>{item.code}</span>
                  <span>{item.en}</span>
                </div>
                <h3>{item.name}</h3>
                <p>{item.note}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="system" className={styles.system} aria-labelledby="system-title">
          <div className={styles.systemHeading}>
            <span className={styles.sectionLabel}>Learning Loop</span>
            <h2 id="system-title">설명으로 시작해<br />{" "}확인으로 완성합니다</h2>
            <p>이해, 적용, 복습. 세 단계가 한 주의 수업 안에서 순환합니다.</p>
          </div>
          <ol className={styles.stepList}>
            {LEARNING_STEPS.map((step, index) => (
              <li className={styles.step} key={step.label}>
                <div className={styles.stepNumber} aria-hidden="true">0{index + 1}</div>
                <div>
                  <span>{step.label}</span>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.labStatement} aria-labelledby="lab-title">
          <div className={styles.labRings} aria-hidden="true"><span /><span /></div>
          <div className={styles.reveal}>
            <span className={styles.sectionLabel}>The Research Room</span>
            <h2 id="lab-title">수업 밖 질문까지<br />{" "}이어지는 연구실</h2>
          </div>
          <div className={`${styles.labBody} ${styles.reveal}`}>
            <p>
              교재를 연구하고, 학생의 질문에 답하는 대치동 연구실.
              수업에서 남은 물음표는 연구실 클리닉에서 다시 풀어냅니다.
            </p>
            <small>
              2025 iMBC 보도에 소개된 연구실 · 2026 명인학원 강좌 안내의 연구실 클리닉과 주차별 학습 확인
            </small>
          </div>
        </section>

        <section id="teacher" className={styles.teacher} aria-labelledby="teacher-title">
          <figure className={styles.teacherPortrait}>
            <div className={styles.teacherPhoto}>
              <img src="/tenants/godmin/landing-portrait.webp" alt="신민 선생님 공식 인터뷰 프로필" loading="lazy" />
            </div>
            <figcaption>
              사진 출처
              <a href={INTERVIEW_URL} target="_blank" rel="noreferrer">르무통 인터뷰</a>
            </figcaption>
          </figure>
          <div className={styles.teacherCopy}>
            <span className={styles.sectionLabel}>Shin Min · Science Instructor</span>
            <h2 id="teacher-title">신민 선생님</h2>
            <p className={styles.teacherIntro}>
              대성마이맥과 대치동 현장에서 통합과학을 가르칩니다. 두각 공식 강사진에는
              통합과학·화학 강사로 소개되어 있으며, 수업에서 배운 내용을 교재와 테스트,
              연구실 클리닉으로 끝까지 이어갑니다.
            </p>
            <div className={styles.teacherPrinciple}>
              <p>
                화학교육을 전공했고, 뮤지컬 무대에 섰습니다.
                그 무대 경험이 학생과 호흡하는 강의에 도움이 된다고 말합니다.
              </p>
              <small>2023 르무통 인터뷰 요약</small>
            </div>
            <div className={styles.profileLinks}>
              {PROFILE_LINKS.map((link) => (
                <a href={link.href} target="_blank" rel="noreferrer" key={link.label}>
                  <span><small className={styles.profileDate}>{link.date}</small><strong>{link.label}</strong><small>{link.detail}</small></span>
                  <ArrowIcon />
                </a>
              ))}
            </div>
            <p className={styles.profileChecked}>공식 프로필·보도 확인: 2026.10.15 · 강좌 일정은 각 학원 안내를 확인해주세요.</p>
          </div>
        </section>

        <section className={styles.finalCta} aria-labelledby="final-cta-title">
          <div className={styles.finalOrbit} aria-hidden="true"><span /><span /></div>
          <div className={`${styles.finalCopy} ${styles.reveal}`}>
            <span className={styles.sectionLabel}>Study with Min.T</span>
            <h2 id="final-cta-title">수업은 교실에서,<br />{" "}학습은 계속 이어집니다.</h2>
            <p>수업 자료와 과제, 테스트 결과, 학습 기록까지. 신과함께에서 한곳에 모아 확인하세요.</p>
            <div className={styles.finalActions}>
              <Link className={styles.primaryAction} to="/login/godmin">
                신과함께 로그인
                <span className={styles.actionIcon}><ArrowIcon /></span>
              </Link>
              <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer">신민T 소식 보기</a>
            </div>
          </div>
        </section>
      </main>

      <GodminSiteFooter />
    </div>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
