import { useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router";
import GuideCatalog from "@/shared/ui/guide/GuideCatalog";
import FeatureGuideReader from "@/shared/ui/guide/FeatureGuideReader";
import { GUIDES, GUIDE_ROLES as ROLES, type GuideRole } from "../promoGuides";
import CtaSection from "../components/CtaSection";
import styles from "./GuidePage.module.css";

function guideRole(params: URLSearchParams): GuideRole {
  return ROLES.find((item) => item === params.get("role")) ?? "admin";
}

function readingLocation(params: URLSearchParams) {
  return JSON.stringify([guideRole(params), params.get("guideBook"), params.get("guidePage")]);
}

export default function GuidePage() {
  const [params, setParams] = useSearchParams();
  const role = guideRole(params);
  const guide = GUIDES[role];
  const screenGuide = useRef<HTMLDetailsElement>(null);
  const explicitlyClosedLocation = useRef<string | null>(null);
  const screenBook = params.get("guideBook");
  const screenPage = params.get("guidePage");
  const currentReadingLocation = readingLocation(params);
  useEffect(() => {
    if (explicitlyClosedLocation.current === currentReadingLocation) return;
    explicitlyClosedLocation.current = null;
    if ((screenBook !== null || screenPage !== null) && screenGuide.current) screenGuide.current.open = true;
  }, [screenBook, screenPage, currentReadingLocation]);

  function rememberExplicitClose() {
    // The URL may already have changed while its React render is still pending.
    // Preserve the native close against that location's delayed opening effect.
    explicitlyClosedLocation.current = screenGuide.current?.open
      ? readingLocation(new URLSearchParams(window.location.search))
      : null;
  }

  function selectRole(nextRole: GuideRole) {
    if (nextRole === role) return;
    const next = new URLSearchParams(params);
    next.set("role", nextRole);
    next.delete("q");
    next.delete("category");
    next.delete("topic");
    setParams(next);
  }

  return (
    <>
      <div className={styles.page}>
        <div className={styles.intro}>
          <p>역할을 고른 뒤 필요한 업무를 검색해 보세요. 사용 순서와 문제 해결 방법을 로그인 없이 읽을 수 있습니다.</p>
          <Link to="/promo/faq">도입 전 자주 묻는 질문 →</Link>
        </div>
        <div className={styles.roles} role="group" aria-label="가이드 이용 역할">
          {ROLES.map((item) => (
            <button key={item} type="button" aria-pressed={role === item} onClick={() => selectRole(item)}>
              {GUIDES[item].label}
            </button>
          ))}
        </div>
        {role !== "student" && <details ref={screenGuide} className={styles.screenGuide}>
          <summary onClick={rememberExplicitClose}>화면으로 기능 살펴보기 <span>5쪽 요약 · 43쪽 상세 설명</span></summary>
          <FeatureGuideReader mode="public" />
        </details>}
        <GuideCatalog key={role} articles={guide.articles} scope={role} mode="public"
          title={`${guide.label} 사용 가이드`}
          description="기능별 사용 순서와 문제 해결 방법입니다. 실제 업무는 로그인 후 권한에 따라 이용할 수 있습니다." />
      </div>
      <CtaSection secondaryPath="/promo/faq" secondaryLabel="자주 묻는 질문" />
    </>
  );
}
