// PATH: src/app_admin/domains/exams/components/BlockReason.tsx
import styles from "./BlockReason.module.css";

export default function BlockReason({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className={`rounded-lg border p-4 text-sm ${styles.root}`}>
      <div className="font-semibold">{title}</div>
      <div className={`mt-1 ${styles.description}`}>{description}</div>
    </div>
  );
}
