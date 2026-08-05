import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router";

import useAuth from "@/auth/hooks/useAuth";

import { fetchMatchupShowcaseList, type MatchupShowcaseCard } from "../api/matchupShowcase";
import {
  fetchProblemReviewShowcaseList,
  type ProblemReviewShowcaseCard,
} from "../api/problemReviewShowcase";
import LandingFooter from "../components/LandingFooter";
import ResilientPublicImage from "../components/ResilientPublicImage";
import type {
  FeatureItem,
  InstructorProfileItem,
  LandingSection,
  ManagementCardItem,
  ProgramItem,
} from "../types";
import { formatLandingYmdDateOrRaw as formatArchiveDate } from "../utils/dateFormat";
import { resolvePublicProgramCopy } from "../utils/publicProgramCopy";
import { resolvePublicReportUrl } from "../utils/publicReportUrl";
import { matchupHitRateLabel } from "../utils/matchupHitRate";
import { resolveTenantCode } from "@/shared/tenant";
import {
  getEnabledSections,
  LandingNavBar,
  resolveHeroPrimaryCta,
  SvgIcon,
  type NavBarTokens,
  type TemplateProps,
} from "./shared";
import styles from "./PremiumDark.module.css";

const NAV_TOKENS: NavBarTokens = {
  bg: "rgba(7, 17, 31, 0.92)",
  border: "rgba(151, 174, 208, 0.18)",
  textPrimary: "#F7FAFF",
  textSecondary: "#AAB8CC",
  primaryColor: "#66A3FF",
  primaryRgb: "102, 163, 255",
  ctaGradient: "linear-gradient(135deg, #76B1FF 0%, #3478F6 100%)",
  ctaTextColor: "#05101E",
  panelBg: "#0A1728",
};

const FOOTER_TOKENS = {
  bg: "#07111F",
  border: "rgba(151, 174, 208, 0.16)",
  textPrimary: "#F7FAFF",
  textSecondary: "#93A4BB",
  textMuted: "#6E819C",
  accent: "#66A3FF",
};

type ArchiveState = {
  loading: boolean;
  failed: boolean;
  items: MatchupShowcaseCard[];
};

type AnalysisState = {
  loading: boolean;
  failed: boolean;
  items: ProblemReviewShowcaseCard[];
};

const DEFAULT_STANDARDS: FeatureItem[] = [
  { icon: "search", title: "학교별 시험 분석", description: "학교와 시험 범위를 기준으로 출제 흐름과 대비 자료를 다시 점검합니다." },
  { icon: "document", title: "수업 자료 직접 제작", description: "수업 전 준비부터 시험 후 매치업 자료까지 같은 기준으로 직접 정리합니다." },
  { icon: "check", title: "시험 후 결과 공개", description: "말로 끝내지 않고 실제 시험과 대비 자료의 결과를 공개 자료로 남깁니다." },
];

const CLASSROOM_PHOTOS = [
  "/tenants/tchul/classroom-lecture-01.webp",
  "/tenants/tchul/classroom-lecture-02.webp",
];

const INSTRUCTOR_PORTRAITS = {
  formal: "/tenants/tchul/instructor-formal-portrait.webp",
  casual: "/tenants/tchul/instructor-casual-portrait.webp",
};

const TCHUL_INQUIRIES = [
  { label: "두각학원", phone: "02-556-1988" },
  { label: "명인학원", phone: "02-6382-0909" },
  { label: "박철 과학 연구소", phone: "010-3502-3313" },
];

export default function PremiumDark({ config }: TemplateProps) {
  const sections = getEnabledSections(config);
  const hero = findSection(sections, "hero");
  const instructor = firstItem<InstructorProfileItem>(findSection(sections, "instructor_profile"));
  const program = firstItem<ProgramItem>(findSection(sections, "programs"));
  const publicProgram = resolvePublicProgramCopy(program);
  const features = sectionItems<FeatureItem>(findSection(sections, "features")).slice(0, 4);
  const management = sectionItems<ManagementCardItem>(findSection(sections, "management_system")).slice(0, 3);
  const primaryCta = resolveHeroPrimaryCta(config, hero || ({ type: "hero" } as LandingSection));
  const tenantCode = resolveTenantCode();
  const isTchul = tenantCode.ok && tenantCode.code === "tchul";
  const configuredInquiries = (config.contact?.inquiries || []).filter(
    (item) => item.label?.trim() && item.phone?.trim(),
  );
  const inquiries = configuredInquiries.length > 0
    ? configuredInquiries
    : (isTchul ? TCHUL_INQUIRIES : (config.contact?.phone
      ? [{ label: "수강 문의", phone: config.contact.phone }]
      : []));
  const publicPrimaryCta = isTchul
    ? { label: "두각학원 수강 문의", link: `tel:${TCHUL_INQUIRIES[0].phone.replace(/[^0-9+]/g, "")}` }
    : primaryCta;
  const { user } = useAuth();
  const isOwner = Boolean(
    user?.is_superuser || user?.tenantRole === "owner" || user?.tenantRole === "admin",
  );
  const [archive, setArchive] = useState<ArchiveState>({ loading: true, failed: false, items: [] });
  const [analysis, setAnalysis] = useState<AnalysisState>({ loading: true, failed: false, items: [] });

  useEffect(() => {
    let cancelled = false;
    fetchMatchupShowcaseList({ skipAuth: true })
      .then((response) => {
        if (!cancelled) {
          setArchive({ loading: false, failed: false, items: response.results.slice(0, 3) });
        }
      })
      .catch(() => {
        if (!cancelled) setArchive({ loading: false, failed: true, items: [] });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchProblemReviewShowcaseList({ skipAuth: true })
      .then((response) => {
        if (!cancelled) setAnalysis({ loading: false, failed: false, items: response.results.slice(0, 2) });
      })
      .catch(() => {
        if (!cancelled) setAnalysis({ loading: false, failed: true, items: [] });
      });
    return () => { cancelled = true; };
  }, []);

  const heroTitle = hero?.title || config.tagline || `${config.brand_name} 통합과학`;
  const heroDescription = hero?.description || config.subtitle;
  const credentials = (instructor?.experience || []).slice(0, 3);
  const standards = useMemo(() => {
    if (features.length > 0) return features;
    const managementStandards = management.map((item) => ({
      icon: item.icon,
      title: item.title,
      description: item.description,
    }));
    return managementStandards.length > 0 ? managementStandards : DEFAULT_STANDARDS;
  }, [features, management]);

  return (
    <div className={styles.site}>
      <LandingNavBar
        config={config}
        sections={sections}
        tokens={NAV_TOKENS}
        brandMark={<BrandMark name={config.brand_name} />}
        topNavVariant="slab"
      />

      <main>
        <section className={styles.hero} data-stype="hero" aria-labelledby="premium-home-title">
          <div className={styles.heroGrid}>
            <div className={styles.heroContent}>
              <div className={styles.kicker}>
                <span className={styles.kickerDot} />
                대치동 두각에서 시작하는 통합과학
              </div>
              <h1 id="premium-home-title" className={styles.heroTitle}>{heroTitle}</h1>
              {heroDescription ? <p className={styles.heroDescription}>{heroDescription}</p> : null}

              <div className={styles.heroActions}>
                <SmartLink to={publicPrimaryCta.link} className={styles.primaryAction} testId="landing-hero-primary-cta">
                  {publicPrimaryCta.label}
                  <Arrow />
                </SmartLink>
                <Link to="/landing/matchup-board" className={styles.secondaryAction}>
                  매치업 자료 보기
                </Link>
              </div>

              <div className={styles.heroProof} aria-label="강의 핵심 정보">
                <span>대치동 현장 강의</span>
                <span>학교별 내신 분석</span>
                <span>수업 후 클리닉</span>
              </div>
            </div>

            <div className={styles.portraitPanel} aria-label={`${instructor?.name || config.brand_name} 수업 현장`}>
              <img className={styles.classroomHero} src={CLASSROOM_PHOTOS[0]} alt="학생들과 함께하는 박철T 통합과학 수업 현장" />
              <div className={styles.classroomLabel}>실제 수업 현장</div>
              <div className={styles.portraitInset}>
                <img
                  className={styles.portrait}
                  src={INSTRUCTOR_PORTRAITS.formal}
                  alt={`정장을 입은 ${instructor?.name || config.brand_name} 공식 프로필`}
                />
              </div>
              <div className={styles.portraitCaption}>
                <span className={styles.utilityLabel}>통합과학 전임 강사</span>
                <strong>{instructor?.name || config.brand_name}</strong>
                <span>{instructor?.title || "통합과학 전임"}</span>
              </div>
            </div>
          </div>
        </section>

        <nav className={styles.quickNav} aria-label="주요 메뉴">
          <QuickLink label="강사와 수업" detail="박철T 소개와 수업 방식" to="/landing/about" />
          <QuickLink label="매치업 자료실" detail="학교 시험과 수업 자료 비교" to="/landing/matchup-board" featured />
          <QuickLink label="시험 분석" detail="문항별 리뷰와 다음 학습" to="/landing/analysis" />
          <QuickLink label="수강 안내" detail="시간표와 상담 연락처" to="#contact" />
        </nav>

        <section className={styles.archiveSection} data-stype="hit_reports" aria-labelledby="archive-title">
          <div className={styles.sectionHeadingRow}>
            <div>
              <span className={styles.utilityLabel}>학교별 매치업 자료</span>
              <h2 id="archive-title">수업에서 준비한 내용,<br />시험지로 확인해 보세요</h2>
              <p>실제 학교 시험과 수업 전에 준비한 자료를 나란히 비교했습니다. 카드를 누르면 첫 쪽부터 끝까지 하나의 게시물처럼 바로 이어서 읽을 수 있습니다.</p>
            </div>
            <div className={styles.archiveActions}>
              {isOwner ? (
                <Link to="/landing/matchup-board?manage=1&compose=upload" className={styles.uploadAction}>
                  PDF 자료 올리기
                  <UploadIcon />
                </Link>
              ) : null}
              <Link to="/landing/matchup-board" className={styles.textAction}>전체 자료 보기 <Arrow /></Link>
            </div>
          </div>

          <ArchiveGrid archive={archive} />
        </section>

        <section className={styles.analysisSection} aria-labelledby="analysis-title">
          <div className={styles.analysisHeading}>
            <div>
              <span className={styles.utilityLabel}>시험 분석 노트</span>
              <h2 id="analysis-title">시험이 끝나면,<br />다음 수업이 시작됩니다</h2>
            </div>
            <div className={styles.analysisIntro}>
              <p>문항별 출제 포인트와 학생이 막힌 지점을 다시 읽습니다. 총평에서 끝내지 않고 다음 시험을 위한 수업 처방까지 남깁니다.</p>
              <Link to="/landing/analysis" className={styles.textAction}>전체 분석 보기 <Arrow /></Link>
            </div>
          </div>
          <AnalysisShowcaseGrid analysis={analysis} />
        </section>

        <section className={styles.standardSection} data-stype="features" aria-labelledby="standard-title">
          <div className={styles.standardIntro}>
            <span className={styles.utilityLabel}>수업 운영 기준</span>
            <h2 id="standard-title">수업 전 준비부터<br />시험 후 확인까지</h2>
            <p>
              자료 제작부터 시험 후 분석까지 같은 기준으로 이어집니다. 자세한 강사 이력과 수업 흐름은 소개 페이지에서 확인할 수 있습니다.
            </p>
            <Link to="/landing/about" className={styles.textAction}>수업 기준 자세히 보기 <Arrow /></Link>
          </div>

          <div className={styles.standardGrid}>
            {standards.slice(0, 4).map((item, index) => (
              <article className={styles.standardCard} key={`${item.title}-${index}`}>
                <div className={styles.standardIcon}><SvgIcon name={item.icon || "check"} size={20} /></div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.profileSection} data-stype="instructor_profile" aria-labelledby="profile-title">
          <figure className={styles.classroomFigure}>
            <img src={CLASSROOM_PHOTOS[1]} alt="칠판 앞에서 학생들에게 통합과학을 설명하는 박철T" loading="lazy" />
            <figcaption>
              <strong>현장에서 직접 설명하고 확인합니다</strong>
              <span>학생이 어디에서 막히는지 수업 중 바로 살핍니다.</span>
            </figcaption>
          </figure>
          <div className={styles.profileCard}>
            <div className={styles.profileCopy}>
              <span className={styles.utilityLabel}>박철T 소개</span>
              <h2 id="profile-title">{instructor?.name || config.brand_name}</h2>
              <p className={styles.profileBio}>
                {instructor?.bio || "수업 전 자료와 수업 후 관리가 하나의 흐름으로 이어지도록 직접 설계하고 운영합니다."}
              </p>
              {credentials.length > 0 ? (
                <ul className={styles.credentials}>
                  {credentials.map((item) => <li key={item}>{item}</li>)}
                </ul>
              ) : null}
            </div>
            <figure className={styles.profilePortraitFigure}>
              <img
                src={INSTRUCTOR_PORTRAITS.casual}
                alt={`${instructor?.name || config.brand_name} 강사 프로필`}
                loading="lazy"
              />
              <figcaption>통합과학을 더 분명하게</figcaption>
            </figure>
          </div>

          <div className={styles.programCard} data-stype="programs">
            <span className={styles.utilityLabel}>{publicProgram?.scheduleNeedsConfirmation ? "수강 안내" : "현재 모집 강좌"}</span>
            <h2>{publicProgram?.title || "통합과학 내신대비"}</h2>
            <p>{publicProgram?.description || config.subtitle}</p>
            {publicProgram?.badge ? <span className={styles.programBadge}>{publicProgram.badge}</span> : null}
          </div>
        </section>

        <section id="contact" className={styles.contactSection} data-stype="contact" aria-labelledby="contact-title">
          <div>
            <span className={styles.utilityLabel}>수강 상담</span>
            <h2 id="contact-title">수업과 자료에 대해<br />편하게 문의하세요</h2>
          </div>
          <div className={styles.contactDetails}>
            {inquiries.map((inquiry, index) => (
              <a
                className={index === 0 && isTchul ? styles.contactPrimary : undefined}
                href={`tel:${inquiry.phone.replace(/[^0-9+]/g, "")}`}
                key={`${inquiry.label}-${inquiry.phone}`}
              >
                <span>{index === 0 && isTchul ? "주요 수강 문의" : "수강 문의"}</span>
                <strong>{inquiry.label}</strong>
                <small>{inquiry.phone}</small>
              </a>
            ))}
            {!isTchul && config.contact?.address ? (
              <div>
                <span>위치</span>
                <strong>{config.contact.address}</strong>
              </div>
            ) : null}
            <SmartLink to={publicPrimaryCta.link} className={styles.contactAction}>
              {publicPrimaryCta.label}
              <Arrow />
            </SmartLink>
          </div>
        </section>
      </main>

      <LandingFooter config={config} sections={sections} tokens={FOOTER_TOKENS} />
    </div>
  );
}

function ArchiveGrid({ archive }: { archive: ArchiveState }) {
  if (archive.loading) {
    return (
      <div className={styles.archiveGrid} aria-label="자료를 불러오는 중">
        {[0, 1, 2].map((item) => <div className={styles.archiveSkeleton} key={item} />)}
      </div>
    );
  }

  if (archive.failed) {
    return (
      <div className={styles.archiveState} role="status">
        자료 목록을 불러오지 못했습니다. 자료실에서 다시 확인해주세요.
        <Link to="/landing/matchup-board">자료실로 이동</Link>
      </div>
    );
  }

  if (archive.items.length === 0) {
    return (
      <div className={styles.archiveState}>
        첫 매치업 자료를 준비하고 있습니다.
        <Link to="/landing/matchup-board">자료실 보기</Link>
      </div>
    );
  }

  return (
    <div className={styles.archiveGrid}>
      {archive.items.map((item, index) => {
        const hitRateLabel = matchupHitRateLabel(item.snapshot_meta?.hit_rate);
        return (
          <Link className={styles.archiveCard} to={`/landing/matchup-board/${item.id}`} key={item.id}>
          <div className={styles.archivePreview}>
            <ResilientPublicImage
              src={item.preview_url ? resolvePublicReportUrl(item.preview_url) : undefined}
              alt=""
              loading={index === 0 ? "eager" : "lazy"}
              fallback={<span>매치업 자료</span>}
            />
          </div>
          <div className={styles.archiveCardTop}>
            <span>{formatArchiveDate(item.published_at)}</span>
            {hitRateLabel ? (
              <strong>적중률 {hitRateLabel}</strong>
            ) : null}
          </div>
          <h3>{item.title}</h3>
          <p>{item.description || "실제 시험과 사전 대비 자료를 비교한 매치업 보고서입니다."}</p>
          <div className={styles.archiveMeta}>
            <span>{item.snapshot_meta?.hit_count !== undefined && item.snapshot_meta?.counted_entries !== undefined
              ? `${item.snapshot_meta.hit_count}/${item.snapshot_meta.counted_entries}문항 적중`
              : "전체 자료"}</span>
            <span>조회 {item.view_count}</span>
          </div>
          </Link>
        );
      })}
    </div>
  );
}

function AnalysisShowcaseGrid({ analysis }: { analysis: AnalysisState }) {
  if (analysis.loading) {
    return <div className={styles.analysisCards} aria-label="시험 분석을 불러오는 중"><div className={styles.analysisSkeleton} /><div className={styles.analysisSkeleton} /></div>;
  }
  if (analysis.failed || analysis.items.length === 0) {
    return (
      <div className={styles.analysisEmpty}>
        <span>{analysis.failed ? "시험 분석 목록을 불러오지 못했습니다." : "첫 시험 분석 공개본을 준비하고 있습니다."}</span>
        <Link to="/landing/analysis">시험 분석 노트 보기</Link>
      </div>
    );
  }
  return (
    <div className={styles.analysisCards}>
      {analysis.items.map((item, index) => (
        <Link className={styles.analysisCard} to={`/landing/analysis/${item.id}`} key={item.id}>
          <div className={styles.analysisPaper} aria-hidden="true">
            <span>0{index + 1}</span>
            <small>EXAM REVIEW</small>
            <strong>{item.metadata.school || "학교별 시험"}</strong>
            <i />
          </div>
          <div className={styles.analysisCardCopy}>
            <div><span>{item.metadata.exam_name || item.metadata.subject || "시험 분석"}</span><span>{formatArchiveDate(item.published_at)}</span></div>
            <h3>{item.title}</h3>
            <p>{item.description || "문항별 출제 의도와 다음 학습 방향을 정리했습니다."}</p>
            <footer><span>{item.summary.total_questions || "-"}문항 분석</span><strong>리포트 읽기 <Arrow /></strong></footer>
          </div>
        </Link>
      ))}
    </div>
  );
}

function QuickLink({ label, detail, to, featured = false }: {
  label: string;
  detail: string;
  to: string;
  featured?: boolean;
}) {
  return (
    <SmartLink to={to} className={`${styles.quickLink} ${featured ? styles.quickLinkFeatured : ""}`}>
      <span className={styles.quickCopy}><strong>{label}</strong><small>{detail}</small></span>
    </SmartLink>
  );
}

function SmartLink({ to, className, testId, children }: {
  to: string;
  className: string;
  testId?: string;
  children: ReactNode;
}) {
  if (to.startsWith("/")) {
    return <Link to={to} className={className} data-testid={testId}>{children}</Link>;
  }
  return <a href={to} className={className} data-testid={testId}>{children}</a>;
}

function BrandMark({ name }: { name: string }) {
  return (
    <div className={styles.brandMark} aria-hidden="true">
      <span>{(name || "박").trim().charAt(0)}</span>
      <i />
    </div>
  );
}

function Arrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 16V4m0 0-4 4m4-4 4 4M5 15v4h14v-4" />
    </svg>
  );
}

function findSection(sections: LandingSection[], type: LandingSection["type"]) {
  return sections.find((section) => section.type === type);
}

function sectionItems<T>(section?: LandingSection): T[] {
  return Array.isArray(section?.items) ? section.items as T[] : [];
}

function firstItem<T>(section?: LandingSection): T | undefined {
  return sectionItems<T>(section)[0];
}
