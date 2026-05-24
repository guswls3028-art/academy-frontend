import styles from "./PathBreadcrumb.module.css";

export type PathCrumb = { id: string | null; name: string };

type PathBreadcrumbProps = {
  path: PathCrumb[];
  onSelect: (folderId: string | null) => void;
};

export default function PathBreadcrumb({ path, onSelect }: PathBreadcrumbProps) {
  return (
    <nav className={styles.root} aria-label="경로">
      {path.map((crumb, i) => (
        <span key={`${i}-${crumb.id ?? "root"}`} className={styles.segment}>
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
