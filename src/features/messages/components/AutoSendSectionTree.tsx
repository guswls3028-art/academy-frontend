// PATH: src/features/messages/components/AutoSendSectionTree.tsx
// 자동발송 — 좌측 섹션 폴더 트리 (가입 / 클리닉 등 구간별 관리)

import { useState } from "react";
import { UserPlus, Stethoscope, Bell, CalendarPlus, CalendarRepeat } from "lucide-react";
import type { AutoSendTrigger } from "../api/messages.api";
import { AUTO_SEND_TRIGGER_LABELS } from "../api/messages.api";
import styles from "./AutoSendSectionTree.module.css";

export type AutoSendSectionId = "signup" | "clinic";

export const AUTO_SEND_SECTIONS: {
  id: AutoSendSectionId;
  label: string;
  icon: React.ReactNode;
  triggers: AutoSendTrigger[];
  children?: { trigger: AutoSendTrigger; label: string; icon: React.ReactNode }[];
}[] = [
  {
    id: "signup",
    label: "가입",
    icon: <UserPlus size={16} aria-hidden />,
    triggers: ["student_signup"],
  },
  {
    id: "clinic",
    label: "클리닉",
    icon: <Stethoscope size={16} aria-hidden />,
    triggers: ["clinic_reminder", "clinic_reservation_created", "clinic_reservation_changed"],
    children: [
      { trigger: "clinic_reminder", label: AUTO_SEND_TRIGGER_LABELS.clinic_reminder, icon: <Bell size={14} aria-hidden /> },
      { trigger: "clinic_reservation_created", label: AUTO_SEND_TRIGGER_LABELS.clinic_reservation_created, icon: <CalendarPlus size={14} aria-hidden /> },
      { trigger: "clinic_reservation_changed", label: AUTO_SEND_TRIGGER_LABELS.clinic_reservation_changed, icon: <CalendarRepeat size={14} aria-hidden /> },
    ],
  },
];

type AutoSendSectionTreeProps = {
  selectedSection: AutoSendSectionId;
  onSelectSection: (section: AutoSendSectionId) => void;
};

export default function AutoSendSectionTree({
  selectedSection,
  onSelectSection,
}: AutoSendSectionTreeProps) {
  const [expandedSection, setExpandedSection] = useState<AutoSendSectionId | null>("clinic");

  return (
    <div className={styles.root}>
      <div className={styles.navHeader}>
        <span className={styles.navTitle}>구간</span>
      </div>
      <nav className={styles.tabs}>
        {AUTO_SEND_SECTIONS.map((section) => {
          const isActive = selectedSection === section.id;
          const isExpanded = expandedSection === section.id;
          const hasChildren = section.children && section.children.length > 0;

          return (
            <div key={section.id} className={styles.branch}>
              <button
                type="button"
                className={`${styles.tab} ${isActive ? styles.tabActive : ""}`}
                onClick={() => onSelectSection(section.id)}
                aria-expanded={hasChildren ? isExpanded : undefined}
                aria-current={isActive ? "true" : undefined}
              >
                <span className={styles.tabIcon}>{section.icon}</span>
                <span className={styles.tabLabel}>{section.label}</span>
                {hasChildren && (
                  <span
                    role="button"
                    tabIndex={0}
                    className={styles.chevron}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setExpandedSection(isExpanded ? null : section.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setExpandedSection(isExpanded ? null : section.id);
                      }
                    }}
                    aria-label={isExpanded ? "접기" : "펼치기"}
                  >
                    {isExpanded ? "▾" : "▸"}
                  </span>
                )}
              </button>
              {hasChildren && isExpanded && (
                <div className={styles.children}>
                  {section.children!.map((child) => (
                    <div key={child.trigger} className={styles.childItem}>
                      <span className={styles.childIcon}>{child.icon}</span>
                      <span className={styles.childLabel}>{child.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
}
