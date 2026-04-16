// PATH: src/app_admin/domains/storage/components/matchup/DocumentUploadModal.tsx

import { useState, useRef } from "react";
import { Upload, X } from "lucide-react";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";

type Props = {
  onClose: () => void;
  onUpload: (payload: { file: File; title: string; subject: string; grade_level: string }) => Promise<void>;
};

const ACCEPT = ".pdf,.png,.jpg,.jpeg";
const MAX_SIZE = 50 * 1024 * 1024;

export default function DocumentUploadModal({ onClose, onUpload }: Props) {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_SIZE) {
      feedback.error("파일 크기가 50MB를 초과합니다.");
      return;
    }
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
  };

  const handleSubmit = async () => {
    if (!file) return;
    setUploading(true);
    try {
      await onUpload({ file, title: title || file.name, subject, grade_level: gradeLevel });
      onClose();
    } catch {
      feedback.error("업로드에 실패했습니다.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--color-bg-surface)", borderRadius: "var(--radius-xl)",
          width: 440, maxWidth: "90vw", padding: "var(--space-6)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-5)" }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>문서 업로드</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)" }}>
            <X size={18} />
          </button>
        </div>

        {/* 파일 선택 */}
        <div
          style={{
            border: "2px dashed var(--color-border-divider)", borderRadius: "var(--radius-lg)",
            padding: "var(--space-6)", textAlign: "center", cursor: "pointer",
            marginBottom: "var(--space-4)",
            background: file ? "color-mix(in srgb, var(--color-brand-primary) 5%, var(--color-bg-surface))" : undefined,
          }}
          onClick={() => inputRef.current?.click()}
        >
          <Upload size={24} style={{ color: "var(--color-text-muted)", marginBottom: "var(--space-2)" }} />
          <p style={{ margin: 0, fontSize: 14, color: "var(--color-text-secondary)" }}>
            {file ? file.name : "PDF, PNG, JPG 파일을 선택하세요"}
          </p>
          {file && (
            <p style={{ margin: "var(--space-1) 0 0", fontSize: 12, color: "var(--color-text-muted)" }}>
              {(file.size / 1024 / 1024).toFixed(1)}MB
            </p>
          )}
          <input ref={inputRef} type="file" accept={ACCEPT} onChange={handleFile} style={{ display: "none" }} />
        </div>

        {/* 메타데이터 */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-secondary)" }}>
            제목
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="문서 제목"
              style={{
                display: "block", width: "100%", marginTop: "var(--space-1)",
                padding: "var(--space-2) var(--space-3)", border: "1px solid var(--color-border-divider)",
                borderRadius: "var(--radius-md)", fontSize: 14, background: "var(--color-bg-surface)",
              }}
            />
          </label>

          <div style={{ display: "flex", gap: "var(--space-3)" }}>
            <label style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--color-text-secondary)" }}>
              과목
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="예: 수학"
                style={{
                  display: "block", width: "100%", marginTop: "var(--space-1)",
                  padding: "var(--space-2) var(--space-3)", border: "1px solid var(--color-border-divider)",
                  borderRadius: "var(--radius-md)", fontSize: 14, background: "var(--color-bg-surface)",
                }}
              />
            </label>
            <label style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--color-text-secondary)" }}>
              학년
              <input
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
                placeholder="예: 고1"
                style={{
                  display: "block", width: "100%", marginTop: "var(--space-1)",
                  padding: "var(--space-2) var(--space-3)", border: "1px solid var(--color-border-divider)",
                  borderRadius: "var(--radius-md)", fontSize: 14, background: "var(--color-bg-surface)",
                }}
              />
            </label>
          </div>
        </div>

        {/* 버튼 */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-2)", marginTop: "var(--space-5)" }}>
          <Button intent="ghost" size="sm" onClick={onClose} disabled={uploading}>
            취소
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={!file || uploading}>
            {uploading ? "업로드 중..." : "업로드"}
          </Button>
        </div>
      </div>
    </div>
  );
}
