import { Link, useSearchParams } from "react-router";
import GuideCatalog from "@/shared/ui/guide/GuideCatalog";
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
          <p>실제 프로그램과 동일한 전체 사용 가이드입니다. 가입 전에도 로그인 없이 읽어보실 수 있습니다.</p>
          <Link to="/promo/faq">도입 전 자주 묻는 질문 →</Link>
        </div>
        <div className={styles.roles} role="group" aria-label="가이드 이용 역할">
          {ROLES.map((item) => (
            <button key={item} type="button" aria-pressed={role === item} onClick={() => selectRole(item)}>
              {GUIDES[item].label}
            </button>
          ))}
        </div>
        <GuideCatalog key={role} articles={guide.articles} scope={role} mode="public"
          title={`${guide.label} 사용 가이드`}
          description="준비사항과 사용 순서부터 완료 확인, 막혔을 때 해결 방법까지 차례대로 확인하세요. 실제 업무 화면은 가입 후 해당 권한으로 로그인하여 이용합니다." />
      </div>
      <CtaSection secondaryPath="/promo/faq" secondaryLabel="자주 묻는 질문" />
    </>
  );
}
