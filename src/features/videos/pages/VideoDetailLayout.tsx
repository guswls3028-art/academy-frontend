// PATH: src/features/videos/pages/VideoDetailLayout.tsx

import { ReactNode } from "react";
import { styles } from "./VideoDetail.styles";

interface Props {
  header: ReactNode;
  subtitle?: ReactNode;
  left: ReactNode;
  right: ReactNode;
  bottom?: ReactNode;
}

export default function VideoDetailLayout({ header, subtitle, left, right, bottom }: Props) {
  return (
    <div className="space-y-6">
      {/* PAGE HEADER: 제목 + 서브타이틀 + 설명, 우측 액션 */}
      <header className={styles.header.wrap}>
        {header}
      </header>
      {subtitle != null && <div className={styles.page.subtitle}>{subtitle}</div>}

      {/* PAGE BODY: 좌(미리보기+정책+메모) | 우(학생 시청 현황) */}
      <div className={styles.layout.root}>
        <div className={styles.layout.left}>{left}</div>
        <div className={styles.layout.right}>{right}</div>
      </div>

      {/* BOTTOM: 파일 정보 / 통계 */}
      {bottom != null && <div className={styles.bottom.wrap}>{bottom}</div>}
    </div>
  );
}
