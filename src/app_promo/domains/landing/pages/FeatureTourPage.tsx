import { Link } from "react-router";
import FeatureGuideReader from "@/shared/ui/guide/FeatureGuideReader";
import CtaSection from "../components/CtaSection";
import styles from "./FeatureTourPage.module.css";

export default function FeatureTourPage() {
  return <>
    <div className={styles.page}>
      <header className={styles.intro}>
        <Link to="/promo/features">← 전체 기능 소개</Link>
        <h1>실제 화면으로 확인하는 핵심 기능</h1>
        <p>먼저 5쪽 요약으로 제공 범위를 확인하고, 43쪽 상세 설명에서 실제 사용 순서를 따라가세요.</p>
      </header>
      <FeatureGuideReader mode="public" />
      <p className={styles.more}><Link to="/promo/guide">역할별 전체 사용 가이드 보기 →</Link></p>
    </div>
    <CtaSection secondaryPath="/promo/guide" secondaryLabel="전체 사용 가이드" />
  </>;
}
