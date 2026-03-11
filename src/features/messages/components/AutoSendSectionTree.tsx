// PATH: src/features/messages/components/AutoSendSectionTree.tsx
// 자동발송 — 좌측 구간 폴더 트리 (9구간). SSOT: backend/docs/AUTO-SEND-EVENT-SPEC.md

import { useState } from "react";
import {
  UserPlus,
  ClipboardCheck,
  BookOpen,
  FileQuestion,
  ListTodo,
  BarChart2,
  Stethoscope,
  CreditCard,
  Megaphone,
  Bell,
  CalendarPlus,
  CalendarSync,
} from "lucide-react";
import { AUTO_SEND_TRIGGER_LABELS } from "../api/messages.api";
import panelStyles from "@/shared/ui/domain/PanelWithTreeLayout.module.css";
import styles from "./AutoSendSectionTree.module.css";

export type AutoSendSectionId =
  | "signup"
  | "attendance"
  | "lecture"
  | "exam"
  | "assignment"
  | "grades"
  | "clinic"
  | "payment"
  | "notice";

type SectionDef = {
  id: AutoSendSectionId;
  label: string;
  icon: React.ReactNode;
  triggers: string[];
  children?: { trigger: string; label: string; icon: React.ReactNode }[];
};

function triggerChild(trigger: string, icon: React.ReactNode) {
  return {
    trigger,
    label: AUTO_SEND_TRIGGER_LABELS[trigger] ?? trigger,
    icon,
  };
}

export const AUTO_SEND_SECTIONS: SectionDef[] = [
  {
    id: "signup",
    label: "가입/등록",
    icon: <UserPlus size={16} aria-hidden />,
    triggers: [
      "student_signup",
      "registration_approved_student",
      "registration_approved_parent",
      "withdrawal_complete",
    ],
    children: [
      triggerChild("student_signup", <Bell size={14} aria-hidden />),
      triggerChild("withdrawal_complete", <Bell size={14} aria-hidden />),
    ],
  },
  {
    id: "attendance",
    label: "출결",
    icon: <ClipboardCheck size={16} aria-hidden />,
    triggers: ["lecture_session_reminder", "check_in_complete", "absent_occurred"],
    children: [
      triggerChild("lecture_session_reminder", <Bell size={14} aria-hidden />),
      triggerChild("check_in_complete", <Bell size={14} aria-hidden />),
      triggerChild("absent_occurred", <Bell size={14} aria-hidden />),
    ],
  },
  {
    id: "lecture",
    label: "강의",
    icon: <BookOpen size={16} aria-hidden />,
    triggers: ["lecture_session_reminder"],
    children: [triggerChild("lecture_session_reminder", <Bell size={14} aria-hidden />)],
  },
  {
    id: "exam",
    label: "시험",
    icon: <FileQuestion size={16} aria-hidden />,
    triggers: [
      "exam_scheduled_days_before",
      "exam_start_minutes_before",
      "exam_not_taken",
      "exam_score_published",
      "retake_assigned",
    ],
    children: [
      triggerChild("exam_scheduled_days_before", <Bell size={14} aria-hidden />),
      triggerChild("exam_start_minutes_before", <Bell size={14} aria-hidden />),
      triggerChild("exam_not_taken", <Bell size={14} aria-hidden />),
      triggerChild("exam_score_published", <Bell size={14} aria-hidden />),
      triggerChild("retake_assigned", <Bell size={14} aria-hidden />),
    ],
  },
  {
    id: "assignment",
    label: "과제",
    icon: <ListTodo size={16} aria-hidden />,
    triggers: [
      "assignment_registered",
      "assignment_due_hours_before",
      "assignment_not_submitted",
    ],
    children: [
      triggerChild("assignment_registered", <Bell size={14} aria-hidden />),
      triggerChild("assignment_due_hours_before", <Bell size={14} aria-hidden />),
      triggerChild("assignment_not_submitted", <Bell size={14} aria-hidden />),
    ],
  },
  {
    id: "grades",
    label: "성적",
    icon: <BarChart2 size={16} aria-hidden />,
    triggers: ["exam_score_published", "monthly_report_generated"],
    children: [
      triggerChild("exam_score_published", <Bell size={14} aria-hidden />),
      triggerChild("monthly_report_generated", <Bell size={14} aria-hidden />),
    ],
  },
  {
    id: "clinic",
    label: "클리닉/상담",
    icon: <Stethoscope size={16} aria-hidden />,
    triggers: [
      "clinic_reservation_created",
      "clinic_reminder",
      "clinic_reservation_changed",
      "counseling_reservation_created",
    ],
    children: [
      triggerChild("clinic_reservation_created", <CalendarPlus size={14} aria-hidden />),
      triggerChild("clinic_reminder", <Bell size={14} aria-hidden />),
      triggerChild("clinic_reservation_changed", <CalendarSync size={14} aria-hidden />),
      triggerChild("counseling_reservation_created", <CalendarPlus size={14} aria-hidden />),
    ],
  },
  {
    id: "payment",
    label: "결제",
    icon: <CreditCard size={16} aria-hidden />,
    triggers: ["payment_complete", "payment_due_days_before"],
    children: [
      triggerChild("payment_complete", <Bell size={14} aria-hidden />),
      triggerChild("payment_due_days_before", <Bell size={14} aria-hidden />),
    ],
  },
  {
    id: "notice",
    label: "운영공지",
    icon: <Megaphone size={16} aria-hidden />,
    triggers: ["urgent_notice"],
    children: [triggerChild("urgent_notice", <Bell size={14} aria-hidden />)],
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
  const [expandedSection, setExpandedSection] = useState<AutoSendSectionId | null>(null);

  return (
    <div className={styles.root}>
      <div className={panelStyles.treeNavHeader}>
        <span className={panelStyles.treeNavTitle}>구간</span>
      </div>
      <div className={panelStyles.treeScroll}>
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
    </div>
  );
}
