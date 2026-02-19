// PATH: src/features/messages/components/TemplateCategoryTree.tsx
// 좌측 카테고리 트리 — 저장소 폴더 트리 스타일

import { FolderOpen } from "lucide-react";
import type { MessageTemplateCategory } from "../api/messages.api";
import { TEMPLATE_CATEGORY_LABELS } from "../constants/templateBlocks";
import styles from "./TemplateCategoryTree.module.css";

const CATEGORIES: MessageTemplateCategory[] = ["default", "lecture", "clinic"];

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
      <button
        type="button"
        className={styles.item + (currentCategory === "default" ? " " + styles.itemActive : "")}
        onClick={() => onSelect("default")}
      >
        <FolderOpen size={16} />
        <span>템플릿</span>
      </button>
      {CATEGORIES.map((cat) => (
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
