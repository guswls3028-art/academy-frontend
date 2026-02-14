// PATH: src/features/storage/components/Breadcrumb.tsx

import styles from "./Breadcrumb.module.css";

type Crumb = { id: string | null; name: string };

type BreadcrumbProps = {
  path: Crumb[];
  onSelect: (folderId: string | null) => void;
};

export default function Breadcrumb({ path, onSelect }: BreadcrumbProps) {
  return (
    <nav className={styles.root} aria-label="경로">
      {path.map((crumb, i) => (
        <span key={crumb.id ?? "root"} className={styles.segment}>
          {i > 0 && <span className={styles.sep}>/</span>}
          <button
            type="button"
            className={styles.link}
            onClick={() => onSelect(crumb.id)}
          >
            {crumb.name}
          </button>
        </span>
      ))}
    </nav>
  );
}
