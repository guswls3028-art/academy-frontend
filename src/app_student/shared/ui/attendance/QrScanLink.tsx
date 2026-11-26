import { Link } from "react-router";
import { ScanLine } from "lucide-react";
import { useAuthContext } from "@/auth/context/AuthContext";
import { ICON } from "@/shared/ui/ds";
import { QR_SCAN_PATH } from "@/shared/api/contracts/attendanceQr";
import styles from "./QrScanLink.module.css";

export default function QrScanLink({ compact = false }: { compact?: boolean }) {
  const { user } = useAuthContext();
  if (user?.tenantRole !== "student") return null;
  if (compact) return <Link to={QR_SCAN_PATH} className={styles.compact}>
    <ScanLine size={ICON.md} aria-hidden="true" /> QR 출석
  </Link>;
  return <Link to={QR_SCAN_PATH} className={styles.link}>
    <ScanLine size={ICON.md} aria-hidden="true" />
    <span><strong>QR 출석</strong><small>수업 출석 · 클리닉 등원·하원</small></span>
    <span aria-hidden="true">›</span>
  </Link>;
}
