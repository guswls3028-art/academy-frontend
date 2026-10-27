import { Link, useSearchParams } from "react-router";
import GuideCatalog from "@/shared/ui/guide/GuideCatalog";
import FeatureGuideReader from "@/shared/ui/guide/FeatureGuideReader";
import { GUIDES, GUIDE_ROLES as ROLES, type GuideRole } from "../promoGuides";
import CtaSection from "../components/CtaSection";
import styles from "./GuidePage.module.css";

export default function GuidePage() {
  const [params, setParams] = useSearchParams();
  const requestedRole = params.get("role");
  const role: GuideRole = ROLES.find((item) => item === requestedRole) ?? "admin";
  const guide = GUIDES[role];

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
          <p>역할별 사용 방법을 안내합니다. 로그인 없이 읽을 수 있습니다.</p>
          <Link to="/promo/faq">도입 전 자주 묻는 질문 →</Link>
        </div>
        <div className={styles.roles} role="group" aria-label="가이드 이용 역할">
          {ROLES.map((item) => (
            <button key={item} type="button" aria-pressed={role === item} onClick={() => selectRole(item)}>
              {GUIDES[item].label}
            </button>
          ))}
        </div>
        {role !== "student" && <FeatureGuideReader mode="public" />}
        <GuideCatalog key={role} articles={guide.articles} scope={role} mode="public"
          title={`${guide.label} 사용 가이드`}
          description="기능별 사용 순서와 문제 해결 방법입니다. 실제 업무는 로그인 후 권한에 따라 이용할 수 있습니다." />
      </div>
      <CtaSection secondaryPath="/promo/faq" secondaryLabel="자주 묻는 질문" />
    </>
  );
}
