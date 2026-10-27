import { Link } from "react-router";
import FeatureGuideReader from "@/shared/ui/guide/FeatureGuideReader";
import CtaSection from "../components/CtaSection";
import styles from "./FeatureTourPage.module.css";

export default function FeatureTourPage() {
  return <>
    <div className={styles.page}>
      <header className={styles.intro}>
        <Link to="/promo/features">← 전체 기능 소개</Link>
        <h1>기능 상세 가이드</h1>
        <p>알림톡, 수업 영상, 엑셀 업로드, 문항별 채점의 화면과 사용 방법입니다.</p>
      </header>
      <FeatureGuideReader mode="public" />
      <p className={styles.more}><Link to="/promo/guide">역할별 전체 사용 가이드 보기 →</Link></p>
    </div>
    <CtaSection secondaryPath="/promo/guide" secondaryLabel="전체 사용 가이드" />
  </>;
}
