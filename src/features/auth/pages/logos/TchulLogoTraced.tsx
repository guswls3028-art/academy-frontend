// PATH: src/features/auth/pages/logos/TchulLogoTraced.tsx
// TchulLogo.png를 bitmap tracing(imagetracerjs)으로 벡터화한 SVG — 재구성/디자인 없음, 픽셀 기반 path
import type { FC } from "react";
import tracedSvg from "./TchulLogoTraced.svg?raw";
import styles from "../login/TchulLoginPage.module.css";

const TchulLogoTraced: FC = () => (
  <div
    className={styles.logoBlock}
    aria-hidden
    dangerouslySetInnerHTML={{ __html: tracedSvg }}
  />
);

export default TchulLogoTraced;
