import { ClipboardCheck } from "lucide-react";
import { Link } from "react-router";
import { Badge } from "@/shared/ui/ds";
import styles from "./PendingHomeworkLink.module.css";

export default function PendingHomeworkLink({ count, to, onNavigate, compact = false }: {
  count: number;
  to: string;
  onNavigate?: () => void;
  compact?: boolean;
}) {
  if (count <= 0) return null;
  const label = `확인 대기 과제 제출 ${count}건 열기`;
  return (
    <Link to={to} onClick={onNavigate} className={compact ? styles.compact : styles.link} aria-label={label} title={label}>
      <ClipboardCheck size={18} aria-hidden="true" />
      {!compact && <span>과제 제출물</span>}
      <Badge tone="danger" variant="solid" size="xs" className={styles.count}>{count > 99 ? "99+" : count}</Badge>
    </Link>
  );
}
