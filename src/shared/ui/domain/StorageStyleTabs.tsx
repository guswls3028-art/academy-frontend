// 저장소 양식 탭 — DomainLayout 내부 콘텐츠 상단용 (메시지·저장소 등 공통)

import { useLocation, useNavigate } from "react-router-dom";
import styles from "./StorageStyleTabs.module.css";

export type StorageStyleTab = {
  key: string;
  label: string;
  path: string;
};

type Props = {
  tabs: StorageStyleTab[];
};

export default function StorageStyleTabs({ tabs }: Props) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className={styles.tabs}>
      {tabs.map((tab) => {
        const isActive =
          location.pathname === tab.path || location.pathname.startsWith(tab.path + "/");
        return (
          <button
            key={tab.key}
            type="button"
            className={styles.tab + (isActive ? " " + styles.tabActive : "")}
            onClick={() => navigate(tab.path)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
