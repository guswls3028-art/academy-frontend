import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router";

import useAuth from "@/auth/hooks/useAuth";

import { fetchMatchupShowcaseList, type MatchupShowcaseCard } from "../api/matchupShowcase";
import LandingFooter from "../components/LandingFooter";
import type {
  FeatureItem,
  InstructorProfileItem,
  LandingSection,
  ManagementCardItem,
  ProgramItem,
} from "../types";
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

const DEFAULT_STANDARDS: FeatureItem[] = [
  { icon: "search", title: "학교별 시험 분석", description: "학교와 시험 범위를 기준으로 출제 흐름과 대비 자료를 다시 점검합니다." },
  { icon: "document", title: "수업 자료 직접 제작", description: "수업 전 준비부터 시험 후 매치업 자료까지 같은 기준으로 직접 정리합니다." },
  { icon: "check", title: "시험 후 결과 공개", description: "말로 끝내지 않고 실제 시험과 대비 자료의 결과를 공개 자료로 남깁니다." },
];

export default function PremiumDark({ config }: TemplateProps) {
  const sections = getEnabledSections(config);
  const hero = findSection(sections, "hero");
  const instructor = firstItem<InstructorProfileItem>(findSection(sections, "instructor_profile"));
  const program = firstItem<ProgramItem>(findSection(sections, "programs"));
  const features = sectionItems<FeatureItem>(findSection(sections, "features")).slice(0, 4);
  const management = sectionItems<ManagementCardItem>(findSection(sections, "management_system")).slice(0, 3);
  const primaryCta = resolveHeroPrimaryCta(config, hero || ({ type: "hero" } as LandingSection));
  const { user } = useAuth();
  const isOwner = Boolean(
    user?.is_superuser || user?.tenantRole === "owner" || user?.tenantRole === "admin",
  );
  const [archive, setArchive] = useState<ArchiveState>({ loading: true, failed: false, items: [] });

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

  const heroImage = instructor?.photo_url || config.hero_image_url || config.hero_images?.[0] || "";
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
                Science instruction · Seoul
              </div>
              <h1 id="premium-home-title" className={styles.heroTitle}>{heroTitle}</h1>
              {heroDescription ? <p className={styles.heroDescription}>{heroDescription}</p> : null}

              <div className={styles.heroActions}>
                <SmartLink to={primaryCta.link} className={styles.primaryAction} testId="landing-hero-primary-cta">
                  {primaryCta.label}
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

            <div className={styles.portraitPanel} aria-label={instructor?.name || config.brand_name}>
              <div className={styles.blueprintGrid} aria-hidden="true" />
              {heroImage ? (
                <img className={styles.portrait} src={heroImage} alt={instructor?.name || config.brand_name} />
              ) : (
                <div className={styles.portraitFallback}>{(instructor?.name || config.brand_name).charAt(0)}</div>
              )}
              <div className={styles.portraitCaption}>
                <span className={styles.utilityLabel}>Lead instructor</span>
                <strong>{instructor?.name || config.brand_name}</strong>
                <span>{instructor?.title || "통합과학 전임"}</span>
              </div>
              <div className={styles.axisLabel} aria-hidden="true">EVIDENCE / CLASS / 2026</div>
            </div>
          </div>
        </section>

        <nav className={styles.quickNav} aria-label="주요 메뉴">
          <QuickLink index="01" label="강사와 수업" detail="철학 · 커리큘럼" to="/landing/about" />
          <QuickLink index="02" label="매치업 자료실" detail="직접 올린 분석 자료" to="/landing/matchup-board" featured />
          <QuickLink index="03" label="수강 안내" detail="시간표 · 상담" to="#contact" />
        </nav>

        <section className={styles.archiveSection} data-stype="hit_reports" aria-labelledby="archive-title">
          <div className={styles.sectionHeadingRow}>
            <div>
              <span className={styles.utilityLabel}>Matchup archive</span>
              <h2 id="archive-title">수업의 결과를 자료로 공개합니다</h2>
              <p>선생님이 직접 완성한 매치업 PDF를 빠르게 열람하고 공유할 수 있습니다.</p>
            </div>
            <div className={styles.archiveActions}>
              {isOwner ? (
                <Link to="/landing/admin/matchup-board?compose=upload" className={styles.uploadAction}>
                  PDF 자료 올리기
                  <UploadIcon />
                </Link>
              ) : null}
              <Link to="/landing/matchup-board" className={styles.textAction}>전체 자료 보기 <Arrow /></Link>
            </div>
          </div>

          <ArchiveGrid archive={archive} />
        </section>

        <section className={styles.standardSection} data-stype="features" aria-labelledby="standard-title">
          <div className={styles.standardIntro}>
            <span className={styles.utilityLabel}>Class standard</span>
            <h2 id="standard-title">설명보다 운영 기준이 먼저 보이는 수업</h2>
            <p>
              자료 제작부터 시험 후 분석까지 같은 기준으로 이어집니다. 자세한 강사 이력과 수업 흐름은 소개 페이지에서 확인할 수 있습니다.
            </p>
            <Link to="/landing/about" className={styles.textAction}>수업 기준 자세히 보기 <Arrow /></Link>
          </div>

          <div className={styles.standardGrid}>
            {standards.slice(0, 4).map((item, index) => (
              <article className={styles.standardCard} key={`${item.title}-${index}`}>
                <span className={styles.standardNumber}>{String(index + 1).padStart(2, "0")}</span>
                <div className={styles.standardIcon}><SvgIcon name={item.icon || "check"} size={20} /></div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.profileSection} data-stype="instructor_profile" aria-labelledby="profile-title">
          <div className={styles.profileCard}>
            <div>
              <span className={styles.utilityLabel}>Instructor note</span>
              <h2 id="profile-title">{instructor?.name || config.brand_name}</h2>
              <p className={styles.profileBio}>
                {instructor?.bio || "수업 전 자료와 수업 후 관리가 하나의 흐름으로 이어지도록 직접 설계하고 운영합니다."}
              </p>
            </div>
            {credentials.length > 0 ? (
              <ul className={styles.credentials}>
                {credentials.map((item) => <li key={item}>{item}</li>)}
              </ul>
            ) : null}
          </div>

          <div className={styles.programCard} data-stype="programs">
            <span className={styles.utilityLabel}>Current class</span>
            <h2>{program?.title || "통합과학 내신대비"}</h2>
            <p>{program?.description || config.subtitle}</p>
            {program?.badge ? <span className={styles.programBadge}>{program.badge}</span> : null}
          </div>
        </section>

        <section id="contact" className={styles.contactSection} data-stype="contact" aria-labelledby="contact-title">
          <div>
            <span className={styles.utilityLabel}>Admissions</span>
            <h2 id="contact-title">수업과 자료에 대해<br />편하게 문의하세요</h2>
          </div>
          <div className={styles.contactDetails}>
            {config.contact?.phone ? (
              <a href={`tel:${config.contact.phone.replace(/[^0-9+]/g, "")}`}>
                <span>전화</span>
                <strong>{config.contact.phone}</strong>
              </a>
            ) : null}
            {config.contact?.address ? (
              <div>
                <span>위치</span>
                <strong>{config.contact.address}</strong>
              </div>
            ) : null}
            <SmartLink to={primaryCta.link} className={styles.contactAction}>
              {primaryCta.label}
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
      {archive.items.map((item, index) => (
        <Link className={styles.archiveCard} to={`/landing/matchup-board/${item.id}`} key={item.id}>
          <div className={styles.archiveCardTop}>
            <span>PDF · MATCHUP</span>
            <span>{String(index + 1).padStart(2, "0")}</span>
          </div>
          <h3>{item.title}</h3>
          <p>{item.description || "실제 시험과 사전 대비 자료를 비교한 매치업 보고서입니다."}</p>
          <div className={styles.archiveMeta}>
            <span>{formatArchiveDate(item.published_at)}</span>
            <span>조회 {item.view_count}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

function QuickLink({ index, label, detail, to, featured = false }: {
  index: string;
  label: string;
  detail: string;
  to: string;
  featured?: boolean;
}) {
  return (
    <SmartLink to={to} className={`${styles.quickLink} ${featured ? styles.quickLinkFeatured : ""}`}>
      <span className={styles.quickIndex}>{index}</span>
      <span className={styles.quickCopy}><strong>{label}</strong><small>{detail}</small></span>
      <Arrow />
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

function formatArchiveDate(value: string | null) {
  if (!value) return "게시일 미정";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
