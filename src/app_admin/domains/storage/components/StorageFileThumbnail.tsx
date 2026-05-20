// PATH: src/app_admin/domains/storage/components/StorageFileThumbnail.tsx
// 저장소 파일 썸네일 — 이미지는 presigned URL로 inline, PDF는 시각 구분 아이콘.

import { useQuery } from "@tanstack/react-query";
import type { CSSProperties } from "react";
import { FileText, Image as ImageIcon, FileSpreadsheet, FileArchive, FilePlay, File as FileIcon } from "lucide-react";
import { getPresignedUrl } from "../api/storage.api";
import type { InventoryFile } from "../api/storage.api";
import styles from "./StorageFileThumbnail.module.css";

type IconChoice = {
  Icon: typeof FileText;
  accent: string;
};

function pickIcon(contentType: string): IconChoice {
  if (contentType.startsWith("video/")) return { Icon: FilePlay, accent: "#7e57c2" };
  if (contentType.startsWith("image/")) return { Icon: ImageIcon, accent: "#26a69a" };
  if (contentType.includes("spreadsheet") || contentType === "application/vnd.ms-excel") {
    return { Icon: FileSpreadsheet, accent: "#2e7d32" };
  }
  if (contentType === "application/zip") return { Icon: FileArchive, accent: "#6d4c41" };
  if (contentType.includes("word") || contentType === "application/msword") {
    return { Icon: FileText, accent: "#1565c0" };
  }
  return { Icon: FileIcon, accent: "var(--color-text-muted)" };
}

export default function StorageFileThumbnail({ file }: { file: InventoryFile }) {
  const ct = file.contentType ?? "";
  const isImage = ct.startsWith("image/");
  const isPdf = ct === "application/pdf";

  // 이미지만 presign 발급 — react-query cache로 동일 r2_key 재사용
  const { data: thumb, isError } = useQuery({
    queryKey: ["storage-thumb", file.id, file.r2Key],
    queryFn: async () => {
      const { url } = await getPresignedUrl(file.r2Key, 3600);
      return url;
    },
    enabled: isImage,
    staleTime: 50 * 60 * 1000, // presign 1시간 TTL 보수적 재사용
    retry: 1,
  });

  if (isImage && thumb && !isError) {
    return (
      <img
        src={thumb}
        alt={file.displayName}
        loading="lazy"
        className={`${styles.thumb} ${styles.image}`}
      />
    );
  }

  if (isPdf) {
    return (
      <div
        title="PDF 문서"
        className={`${styles.thumb} ${styles.iconBox} ${styles.pdf}`}
      >
        <FileText size={26} className={styles.pdfIcon} />
        <span className={styles.pdfLabel}>
          PDF
        </span>
      </div>
    );
  }

  const { Icon, accent } = pickIcon(ct);
  const iconStyle = {
    "--thumbnail-accent": accent,
  } as CSSProperties;

  return (
    <div
      className={`${styles.thumb} ${styles.iconBox} ${styles.generic}`}
      style={iconStyle}
    >
      <Icon size={26} className={styles.genericIcon} />
    </div>
  );
}
