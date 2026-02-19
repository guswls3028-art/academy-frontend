// PATH: src/features/messages/components/TemplateCategoryTree.tsx
// 좌측 카테고리 트리 — 저장소 폴더 트리 스타일

import { FolderOpen } from "lucide-react";
import type { MessageTemplateCategory } from "../api/messages.api";
import styles from "./TemplateCategoryTree.module.css";

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
        <span>기본</span>
      </button>
      <div className={styles.node}>
        <button
          type="button"
          className={styles.item + (currentCategory === "lecture" ? " " + styles.itemActive : "")}
          onClick={() => onSelect("lecture")}
        >
          <FolderOpen size={16} />
          <span>강의</span>
        </button>
      </div>
      <div className={styles.node}>
        <button
          type="button"
          className={styles.item + (currentCategory === "clinic" ? " " + styles.itemActive : "")}
          onClick={() => onSelect("clinic")}
        >
          <FolderOpen size={16} />
          <span>클리닉</span>
        </button>
      </div>
    </div>
  );
}
