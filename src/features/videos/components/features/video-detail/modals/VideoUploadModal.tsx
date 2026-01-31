// PATH: src/features/videos/components/features/video-detail/modals/VideoUploadModal.tsx

/**
 * VideoUploadModal
 *
 * ✅ 변경 목적(디자인만):
 * - exams 기준 모달 구조
 *   - header = 텍스트 블록
 *   - body = surface(bg-surface-soft)
 * - 불필요한 card/border 제거
 *
 * ✅ 로직/props/상태/업로드 플로우 그대로 유지
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
    return Number.isFinite(sessionId) && sessionId > 0 && !!file && title.trim().length > 0;
  }, [sessionId, file, title]);

  const uploadMut = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("파일이 없습니다.");

      const initPayload = {
        session: sessionId,
        title: title.trim(),
        filename: file.name,
        content_type: file.type || "video/mp4",

        show_watermark: showWatermark,
        allow_skip: allowSkip,
        max_speed: maxSpeed,

        ...(description.trim() ? { description: description.trim() } : {}),
      };

      const initRes = await api.post<UploadInitResponse>("/media/videos/upload/init/", initPayload);

      const uploadUrl = initRes.data?.upload_url;
      const videoId = initRes.data?.video?.id;
      const contentTypeFromServer = initRes.data?.content_type;

      if (!uploadUrl || !videoId) throw new Error("업로드 초기화에 실패했습니다.");

      const putHeaders: Record<string, string> = {};
      if (contentTypeFromServer) putHeaders["Content-Type"] = contentTypeFromServer;

      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: putHeaders,
      });

      if (!putRes.ok) {
        throw new Error(`R2 업로드 실패: ${putRes.status} ${putRes.statusText}`);
      }

      const completeRes = await api.post(`/media/videos/${videoId}/upload/complete/`, { ok: true });
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-[var(--bg-surface)] shadow-xl">
        {/* ✅ header = 텍스트 블록 */}
        <div className="px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-[var(--text-primary)]">영상 추가</div>
              <div className="mt-1 text-xs text-[var(--text-muted)]">
                파일 업로드 및 재생 정책을 설정합니다.
              </div>
            </div>

            <button
              type="button"
              className="shrink-0 rounded border border-[var(--border-divider)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-surface-soft)]"
              onClick={onClose}
              disabled={uploadMut.isPending}
            >
              닫기
            </button>
          </div>
        </div>

        {/* ✅ body = surface */}
        <div className="px-5 pb-5">
          <div className="bg-[var(--bg-surface-soft)] rounded-lg p-4 space-y-4">
            {/* Title */}
            <div>
              <div className="mb-1 text-xs font-medium text-[var(--text-secondary)]">제목</div>
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
              <div className="mb-1 text-xs font-medium text-[var(--text-secondary)]">파일 업로드</div>

              <div
                className="flex cursor-pointer items-center justify-center rounded border border-dashed border-[var(--border-divider)] bg-[var(--bg-surface)] px-4 py-6 text-sm text-[var(--text-muted)] hover:bg-[var(--bg-app)]"
                onClick={pickFile}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") pickFile();
                }}
              >
                {file ? (
                  <div className="text-center">
                    <div className="font-medium text-[var(--text-primary)]">{file.name}</div>
                    <div className="mt-1 text-xs text-[var(--text-muted)]">클릭해서 파일 변경</div>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="font-medium text-[var(--text-primary)]">여기를 클릭해서 업로드</div>
                    <div className="mt-1 text-xs text-[var(--text-muted)]">mp4 등 동영상 파일</div>
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
              <div className="mb-1 text-xs font-medium text-[var(--text-secondary)]">영상 설명</div>
              <textarea
                className="h-24 w-full resize-none rounded border border-[var(--border-divider)] bg-[var(--bg-app)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                placeholder="(선택)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Options */}
            <div className="rounded-lg bg-[var(--bg-surface)] p-3">
              <div className="mb-2 text-xs font-medium text-[var(--text-secondary)]">재생 정책</div>

              <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--text-primary)]">
                <label className="flex items-center gap-2">
                  <span className="text-sm">워터마크</span>
                  <button
                    type="button"
                    onClick={() => setShowWatermark((v) => !v)}
                    className={[
                      "h-6 w-11 rounded-full border border-[var(--border-divider)] transition",
                      showWatermark ? "bg-[var(--color-primary)]" : "bg-[var(--bg-app)]",
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

                <label className="flex items-center gap-2">
                  <span className="text-sm">건너뛰기</span>
                  <button
                    type="button"
                    onClick={() => setAllowSkip((v) => !v)}
                    className={[
                      "h-6 w-11 rounded-full border border-[var(--border-divider)] transition",
                      allowSkip ? "bg-[var(--color-primary)]" : "bg-[var(--bg-app)]",
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

              <div className="mt-2 text-xs text-[var(--text-muted)]">session_id: {sessionId}</div>
            </div>

            {/* Actions (footer를 body 내부로 넣어서 ‘body=surface’ 유지) */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="rounded border border-[var(--border-divider)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-app)] disabled:opacity-50"
                onClick={onClose}
                disabled={uploadMut.isPending}
              >
                취소
              </button>

              <button
                type="button"
                className="rounded bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                onClick={() => {
                  onClose();          // ✅ 즉시 닫기
                  uploadMut.mutate(); // ✅ 백그라운드 업로드
                }}
                disabled={!canSubmit}
              >
                업로드
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
