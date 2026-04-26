// PATH: src/app_admin/domains/storage/components/StorageFileThumbnail.tsx
// 저장소 파일 썸네일 — 이미지는 presigned URL로 inline, PDF는 시각 구분 아이콘.

import { useQuery } from "@tanstack/react-query";
import { FileText, Image as ImageIcon, FileSpreadsheet, FileArchive, FilePlay, File as FileIcon } from "lucide-react";
import { getPresignedUrl } from "../api/storage.api";
import type { InventoryFile } from "../api/storage.api";

const SIZE = 56;

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
        style={{
          width: SIZE,
          height: SIZE,
          objectFit: "cover",
          borderRadius: "var(--radius-sm)",
          background: "var(--color-bg-surface-soft)",
          border: "1px solid var(--color-border-divider)",
          flexShrink: 0,
        }}
      />
    );
  }

  if (isPdf) {
    return (
      <div
        title="PDF 문서"
        style={{
          width: SIZE,
          height: SIZE,
          display: "grid",
          placeItems: "center",
          background: "color-mix(in srgb, #d32f2f 8%, var(--color-bg-surface-soft))",
          border: "1px solid color-mix(in srgb, #d32f2f 25%, transparent)",
          borderRadius: "var(--radius-sm)",
          flexShrink: 0,
          position: "relative",
        }}
      >
        <FileText size={26} style={{ color: "#d32f2f" }} />
        <span
          style={{
            position: "absolute",
            bottom: 4,
            fontSize: 8,
            fontWeight: 800,
            color: "#d32f2f",
            letterSpacing: 0.6,
          }}
        >
          PDF
        </span>
      </div>
    );
  }

  const { Icon, accent } = pickIcon(ct);
  return (
    <div
      style={{
        width: SIZE,
        height: SIZE,
        display: "grid",
        placeItems: "center",
        background: `color-mix(in srgb, ${accent} 6%, var(--color-bg-surface-soft))`,
        border: `1px solid color-mix(in srgb, ${accent} 18%, transparent)`,
        borderRadius: "var(--radius-sm)",
        flexShrink: 0,
      }}
    >
      <Icon size={26} style={{ color: accent }} />
    </div>
  );
}
