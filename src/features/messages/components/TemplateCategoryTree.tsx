// PATH: src/features/messages/components/TemplateCategoryTree.tsx
// 좌측 카테고리 트리 — 자동발송 9구간과 동일한 카테고리 구조

import { FolderOpen } from "lucide-react";
import type { MessageTemplateCategory } from "../api/messages.api";
import { TEMPLATE_CATEGORY_LABELS } from "../constants/templateBlocks";
import type { TemplateCategory } from "../constants/templateBlocks";
import styles from "./TemplateCategoryTree.module.css";

const CATEGORY_ORDER: TemplateCategory[] = [
  "default",
  "signup",
  "attendance",
  "lecture",
  "exam",
  "assignment",
  "grades",
  "clinic",
  "payment",
  "notice",
];

type TemplateCategoryTreeProps = {
  currentCategory: MessageTemplateCategory;
  onSelect: (category: MessageTemplateCategory) => void;
};

export default function TemplateCategoryTree({
  currentCategory,
  onSelect,
}: TemplateCategoryTreeProps) {
  return (
    <div className={styles.root}>
      {CATEGORY_ORDER.map((cat) => (
        <div key={cat} className={styles.node}>
          <button
            type="button"
            className={styles.item + (currentCategory === cat ? " " + styles.itemActive : "")}
            onClick={() => onSelect(cat)}
          >
            <FolderOpen size={16} />
            <span>{TEMPLATE_CATEGORY_LABELS[cat]}</span>
          </button>
        </div>
      ))}
    </div>
  );
}
