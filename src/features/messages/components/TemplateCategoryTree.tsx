// PATH: src/features/messages/components/TemplateCategoryTree.tsx
// 좌측 카테고리 트리 — AutoSendSectionTree SSOT 동일 스타일

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
  MessageCircle,
  Users,
  LayoutGrid,
} from "lucide-react";
import type { MessageTemplateCategory } from "../api/messages.api";
import { TEMPLATE_CATEGORY_LABELS } from "../constants/templateBlocks";
import type { TemplateCategory } from "../constants/templateBlocks";
import panelStyles from "@/shared/ui/domain/PanelWithTreeLayout.module.css";
import styles from "./AutoSendSectionTree.module.css";

const CATEGORY_DEFS: { id: TemplateCategory; icon: React.ReactNode }[] = [
  { id: "default", icon: <LayoutGrid size={16} aria-hidden /> },
  { id: "signup", icon: <UserPlus size={16} aria-hidden /> },
  { id: "attendance", icon: <ClipboardCheck size={16} aria-hidden /> },
  { id: "lecture", icon: <BookOpen size={16} aria-hidden /> },
  { id: "exam", icon: <FileQuestion size={16} aria-hidden /> },
  { id: "assignment", icon: <ListTodo size={16} aria-hidden /> },
  { id: "grades", icon: <BarChart2 size={16} aria-hidden /> },
  { id: "clinic", icon: <Stethoscope size={16} aria-hidden /> },
  { id: "payment", icon: <CreditCard size={16} aria-hidden /> },
  { id: "notice", icon: <Megaphone size={16} aria-hidden /> },
  { id: "community", icon: <MessageCircle size={16} aria-hidden /> },
  { id: "staff", icon: <Users size={16} aria-hidden /> },
];

type TemplateCategoryTreeProps = {
  currentCategory: MessageTemplateCategory;
  onSelect: (category: MessageTemplateCategory) => void;
  templateCounts?: Record<string, number>;
};

export default function TemplateCategoryTree({
  currentCategory,
  onSelect,
  templateCounts,
}: TemplateCategoryTreeProps) {
  return (
    <div className={styles.root}>
      <div className={panelStyles.treeNavHeader}>
        <span className={panelStyles.treeNavTitle}>카테고리</span>
      </div>
      <div className={panelStyles.treeScroll}>
        <nav className={styles.tabs}>
          {CATEGORY_DEFS.map((cat) => {
            const isActive = currentCategory === cat.id;
            const count = templateCounts?.[cat.id];
            return (
              <div key={cat.id} className={styles.branch}>
                <button
                  type="button"
                  className={`${styles.tab} ${isActive ? styles.tabActive : ""}`}
                  onClick={() => onSelect(cat.id)}
                  aria-current={isActive ? "true" : undefined}
                >
                  <span className={styles.tabIcon}>{cat.icon}</span>
                  <span className={styles.tabLabel}>
                    {TEMPLATE_CATEGORY_LABELS[cat.id]}
                  </span>
                  {count !== undefined && count > 0 && (
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--color-text-muted)",
                        marginLeft: "auto",
                        fontWeight: 400,
                      }}
                    >
                      {count}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
