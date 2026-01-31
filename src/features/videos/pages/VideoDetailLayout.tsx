// PATH: src/features/videos/pages/VideoDetailLayout.tsx

import { ReactNode } from "react";
import { styles } from "./VideoDetail.styles";

interface Props {
  header: ReactNode;
  subtitle?: ReactNode;
  left: ReactNode;
  right: ReactNode;
}

export default function VideoDetailLayout({ header, subtitle, left, right }: Props) {
  return (
    <div className="space-y-6">
      {/* PAGE HEADER */}
      <div>{header}</div>

      {subtitle && <div className={styles.page.subtitle}>{subtitle}</div>}

      {/* PAGE BODY */}
      <div className={styles.layout.root}>
        <div className={styles.layout.left}>{left}</div>

        {/* RIGHT = 상태 / 관리 패널 */}
        <div className={styles.layout.right}>{right}</div>
      </div>
    </div>
  );
}
