// src/features/videos/pages/VideoDetailLayout.tsx

import { ReactNode } from "react";
import { styles } from "./VideoDetail.styles";

interface Props {
  header: ReactNode;
  subtitle: ReactNode;
  left: ReactNode;
  right: ReactNode;
}

export default function VideoDetailLayout({
  header,
  subtitle,
  left,
  right,
}: Props) {
  return (
    <>
      {header}

      <div className={styles.page.subtitle}>{subtitle}</div>

      <div className={styles.layout.root}>
        <div className={styles.layout.left}>{left}</div>
        {right}
      </div>
    </>
  );
}
