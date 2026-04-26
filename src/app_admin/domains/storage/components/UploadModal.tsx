// PATH: src/app_admin/domains/storage/components/UploadModal.tsx
// 파일 업로드 모달 — 제목, 설명, 아이콘(Lucide), 파일 선택

import { useState, useRef } from "react";
import { FileText, Image, File, Sparkles } from "lucide-react";
import { Button, CloseButton } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { compressImageToWebP } from "../utils/imageCompress";
import styles from "./UploadModal.module.css";

const ICON_OPTIONS = [
  { id: "file-text", label: "문서", Icon: FileText },
  { id: "image", label: "이미지", Icon: Image },
  { id: "file", label: "파일", Icon: File },
] as const;

const MATCHUP_SUPPORTED_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
]);

type UploadPayload = {
  displayName: string;
  description: string;
  icon: string;
  file: File;
  promoteToMatchup?: boolean;
};

type UploadModalProps = {
  onClose: () => void;
  onUpload: (payload: UploadPayload) => Promise<void>;
};

export default function UploadModal({ onClose, onUpload }: UploadModalProps) {
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState<string>("file-text");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [promoteToMatchup, setPromoteToMatchup] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const matchupEligible = file ? MATCHUP_SUPPORTED_TYPES.has(file.type) : false;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.type.startsWith("image/")) {
      try {
        const compressed = await compressImageToWebP(f);
        setFile(compressed);
      } catch {
        setFile(f);
      }
    } else {
      setFile(f);
    }
    if (!displayName) setDisplayName(f.name.replace(/\.[^.]+$/, "") || f.name);
    e.target.value = "";
  };

  const handleSubmit = async () => {
    if (!file) {
      feedback.warning("파일을 선택해 주세요.");
      return;
    }
    setUploading(true);
    try {
      await onUpload({
        displayName: displayName.trim() || file.name,
        description,
        icon,
        file,
        promoteToMatchup: promoteToMatchup && matchupEligible,
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span>파일 업로드</span>
          <CloseButton onClick={onClose} />
        </div>
        <div className={styles.body}>
          <div className={styles.field}>
            <label>제목</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="제목"
            />
          </div>
          <div className={styles.field}>
            <label>설명</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="설명 (선택)"
              rows={2}
            />
          </div>
          <div className={styles.field}>
            <label>아이콘</label>
            <div className={styles.iconGrid}>
              {ICON_OPTIONS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  className={styles.iconBtn + (icon === id ? " " + styles.iconBtnActive : "")}
                  onClick={() => setIcon(id)}
                  title={label}
                >
                  <Icon size={24} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className={styles.field}>
            <label>파일</label>
            <input
              ref={inputRef}
              type="file"
              className={styles.srOnly}
              onChange={handleFileChange}
              aria-hidden
            />
            <Button
              type="button"
              size="sm"
              intent="secondary"
              onClick={() => inputRef.current?.click()}
            >
              {file ? file.name : "파일 선택"}
            </Button>
          </div>
          {file && matchupEligible && (
            <div className={styles.field}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                <input
                  type="checkbox"
                  data-testid="upload-modal-promote-matchup"
                  checked={promoteToMatchup}
                  onChange={(e) => setPromoteToMatchup(e.target.checked)}
                />
                <Sparkles size={14} style={{ color: "var(--color-brand-primary)" }} />
                <span>매치업 자료로도 등록 (AI 분석)</span>
              </label>
              {promoteToMatchup && (
                <span style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 4, marginLeft: 24 }}>
                  저장 후 매치업 페이지에서 분석 진행률을 확인할 수 있습니다.
                </span>
              )}
            </div>
          )}
        </div>
        <div className={styles.footer}>
          <Button size="sm" intent="secondary" onClick={onClose}>
            취소
          </Button>
          <Button
            size="sm"
            intent="primary"
            onClick={handleSubmit}
            disabled={!file || uploading}
          >
            {uploading ? "업로드 중…" : "업로드"}
          </Button>
        </div>
      </div>
    </div>
  );
}
