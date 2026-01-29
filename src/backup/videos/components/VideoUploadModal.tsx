// PATH: src/features/videos/components/VideoUploadModal.tsx
/**
 * VideoUploadModal
 *
 * ✅ 변경 목적
 * - 기존 UI/옵션/props 전부 유지
 * - 업로드 방식만 "정석(B)"로 변경
 *   1) POST  /media/videos/upload/init   (JSON)
 *   2) PUT   presigned upload_url        (R2 direct)
 *   3) POST  /media/videos/{id}/upload/complete (JSON)
 *
 * ✅ 유지 사항
 * - props 시그니처: (sessionId, isOpen, onClose)
 * - 디자인 토큰/레이아웃
 * - title/description/file/정책(워터마크/건너뛰기/배속) UI
 *
 * ⚠️ IMPORTANT (R2 Content-Type 이슈)
 * - 과거 너 프로젝트에서 "presigned PUT 시 Content-Type 제거 필요" 케이스가 있었음.
 * - 그래서 PUT 요청은 기본적으로 Content-Type 헤더를 강제하지 않고,
 *   필요하면 init에서 받은 content_type을 조건부로만 붙이도록 처리.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axios";

type Props = {
  sessionId: number;
  isOpen: boolean;
  onClose: () => void;
};

type UploadInitResponse = {
  video: { id: number };
  upload_url: string;
  file_key: string;
  content_type?: string;
};

export default function VideoUploadModal({ sessionId, isOpen, onClose }: Props) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [showWatermark, setShowWatermark] = useState(true);
  const [allowSkip, setAllowSkip] = useState(false);
  const [maxSpeed, setMaxSpeed] = useState<number>(1);

  useEffect(() => {
    if (!isOpen) return;
    setTitle("");
    setDescription("");
    setFile(null);
    setShowWatermark(true);
    setAllowSkip(false);
    setMaxSpeed(1);
  }, [isOpen]);

  const canSubmit = useMemo(() => {
    return (
      Number.isFinite(sessionId) &&
      sessionId > 0 &&
      !!file &&
      title.trim().length > 0
    );
  }, [sessionId, file, title]);

  const uploadMut = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("파일이 없습니다.");

      // ==================================================
      // 1) init: presigned PUT URL 발급 (JSON)
      // ==================================================
      const initPayload = {
        session: sessionId, // 백엔드가 session 키를 읽음
        title: title.trim(),
        filename: file.name,
        content_type: file.type || "video/mp4",

        // 정책
        show_watermark: showWatermark,
        allow_skip: allowSkip,
        max_speed: maxSpeed,

        // (선택) description은 현재 upload_init에서 받지 않지만
        // UI 입력 유지 목적 + 확장 대비로 payload에 포함(무시돼도 OK)
        ...(description.trim() ? { description: description.trim() } : {}),
      };

      const initRes = await api.post<UploadInitResponse>(
        "/media/videos/upload/init/",
        initPayload
      );

      const uploadUrl = initRes.data?.upload_url;
      const videoId = initRes.data?.video?.id;
      const contentTypeFromServer = initRes.data?.content_type;

      if (!uploadUrl || !videoId) {
        throw new Error("업로드 초기화에 실패했습니다.");
      }

      // ==================================================
      // 2) PUT: R2로 파일 직접 업로드 (presigned URL)
      // ==================================================
      // ⚠️ R2 환경에서 Content-Type 헤더가 문제 되는 케이스가 있어서
      // "강제하지 않고" 서버가 내려준 content_type이 있을 때만 조건부로 적용
      const putHeaders: Record<string, string> = {};
      if (contentTypeFromServer) {
        putHeaders["Content-Type"] = contentTypeFromServer;
      }

      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: putHeaders,
      });

      if (!putRes.ok) {
        // presigned PUT 실패시 상세 로그
        const msg = `R2 업로드 실패: ${putRes.status} ${putRes.statusText}`;
        throw new Error(msg);
      }

      // ==================================================
      // 3) complete: 업로드 완료 처리 + 워커 트리거 (JSON)
      // ==================================================
      const completeRes = await api.post(`/media/videos/${videoId}/upload/complete/`, {
        // body가 꼭 필요하진 않지만 JSON 형태로 보내면 안정적
        ok: true,
      });

      return completeRes.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["session-videos", sessionId] });
      onClose();
    },
    onError: (e: any) => {
      alert(e?.response?.data?.detail || e?.message || "업로드에 실패했습니다.");
    },
  });

  if (!isOpen) return null;

  const pickFile = () => fileInputRef.current?.click();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-lg rounded-xl bg-[var(--bg-surface)] shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-divider)] px-5 py-4">
          <div className="text-base font-semibold text-[var(--text-primary)]">
            영상 추가
          </div>

          <button
            type="button"
            className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 p-5">
          {/* Title */}
          <div>
            <div className="mb-1 text-xs font-medium text-[var(--text-secondary)]">
              제목
            </div>
            <input
              className="w-full rounded border border-[var(--border-divider)] bg-[var(--bg-app)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
              placeholder="예: 1강 OT"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          {/* File */}
          <div>
            <div className="mb-1 text-xs font-medium text-[var(--text-secondary)]">
              파일 업로드
            </div>

            <div
              className="flex cursor-pointer items-center justify-center rounded border border-dashed border-[var(--border-divider)] bg-[var(--bg-surface-soft)] px-4 py-6 text-sm text-[var(--text-muted)] hover:bg-[var(--bg-app)]"
              onClick={pickFile}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") pickFile();
              }}
            >
              {file ? (
                <div className="text-center">
                  <div className="font-medium text-[var(--text-primary)]">
                    {file.name}
                  </div>
                  <div className="mt-1 text-xs text-[var(--text-muted)]">
                    클릭해서 파일 변경
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <div className="font-medium text-[var(--text-primary)]">
                    여기를 클릭해서 업로드
                  </div>
                  <div className="mt-1 text-xs text-[var(--text-muted)]">
                    mp4 등 동영상 파일
                  </div>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="video/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {/* Description */}
          <div>
            <div className="mb-1 text-xs font-medium text-[var(--text-secondary)]">
              영상 설명
            </div>
            <textarea
              className="h-24 w-full resize-none rounded border border-[var(--border-divider)] bg-[var(--bg-app)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
              placeholder="(선택)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Options */}
          <div className="rounded border border-[var(--border-divider)] bg-[var(--bg-surface-soft)] p-3">
            <div className="mb-2 text-xs font-medium text-[var(--text-secondary)]">
              재생 정책
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--text-primary)]">
              {/* Watermark */}
              <label className="flex items-center gap-2">
                <span className="text-sm">워터마크</span>
                <button
                  type="button"
                  onClick={() => setShowWatermark((v) => !v)}
                  className={[
                    "h-6 w-11 rounded-full border border-[var(--border-divider)] transition",
                    showWatermark
                      ? "bg-[var(--color-primary)]"
                      : "bg-[var(--bg-app)]",
                  ].join(" ")}
                  aria-pressed={showWatermark}
                >
                  <span
                    className={[
                      "block h-5 w-5 translate-x-0.5 rounded-full bg-white transition",
                      showWatermark ? "translate-x-5" : "",
                    ].join(" ")}
                  />
                </button>
              </label>

              {/* Skip */}
              <label className="flex items-center gap-2">
                <span className="text-sm">건너뛰기</span>
                <button
                  type="button"
                  onClick={() => setAllowSkip((v) => !v)}
                  className={[
                    "h-6 w-11 rounded-full border border-[var(--border-divider)] transition",
                    allowSkip
                      ? "bg-[var(--color-primary)]"
                      : "bg-[var(--bg-app)]",
                  ].join(" ")}
                  aria-pressed={allowSkip}
                >
                  <span
                    className={[
                      "block h-5 w-5 translate-x-0.5 rounded-full bg-white transition",
                      allowSkip ? "translate-x-5" : "",
                    ].join(" ")}
                  />
                </button>
              </label>

              {/* Max Speed */}
              <label className="flex items-center gap-2">
                <span className="text-sm">최대 배속</span>
                <input
                  type="number"
                  min={1}
                  max={5}
                  step={0.25}
                  className="w-20 rounded border border-[var(--border-divider)] bg-[var(--bg-app)] px-2 py-1 text-sm text-[var(--text-primary)]"
                  value={Number.isFinite(maxSpeed) ? maxSpeed : 1}
                  onChange={(e) => setMaxSpeed(Number(e.target.value))}
                />
              </label>
            </div>

            <div className="mt-2 text-xs text-[var(--text-muted)]">
              session_id: {sessionId}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-[var(--border-divider)] px-5 py-4">
          <button
            type="button"
            className="rounded border border-[var(--border-divider)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-surface-soft)]"
            onClick={onClose}
            disabled={uploadMut.isPending}
          >
            취소
          </button>

          <button
            type="button"
            className="rounded bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            onClick={() => uploadMut.mutate()}
            disabled={!canSubmit || uploadMut.isPending}
          >
            {uploadMut.isPending ? "업로드 중..." : "업로드"}
          </button>
        </div>
      </div>
    </div>
  );
}
