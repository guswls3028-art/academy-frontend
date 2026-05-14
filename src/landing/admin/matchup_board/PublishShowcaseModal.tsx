// PATH: src/landing/admin/matchup_board/PublishShowcaseModal.tsx
// 매치업 게시판 신규 게시 모달 — mode 라디오 + picker + file upload + form.
// 분리 출처: LandingMatchupBoardAdminPage.tsx (P1 audit step 2 2026-05-14).
//
// 책임:
//   - mode toggle (existing 콘솔 보고서 / upload PC PDF)
//   - existing: hit_report picker
//   - upload: drag-drop + file input + 원본 보고서 연결 (선택)
//   - 공통: title / description / 공개 시작·종료
//   - submit → publishMatchupShowcase or publishMatchupShowcaseUpload
//
// state 모두 own — main page state pollution 회피. reports 도 modal mount 시 1회 fetch.
/* eslint-disable no-restricted-syntax */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { feedback } from "@/shared/ui/feedback/feedback";
import {
  fetchHitReportList,
  type HitReportListItem,
} from "@/app_admin/domains/storage/api/matchup.api";
import {
  publishMatchupShowcase,
  publishMatchupShowcaseUpload,
} from "../../api/matchupShowcase";
import { inputDatetimeLocalToISO } from "./helpers";

export type PublishMode = "existing" | "upload";

interface PublishFormState {
  hit_report_id: number | null;
  title: string;
  description: string;
  published_at: string;
  published_until: string;
}

const INITIAL_FORM: PublishFormState = {
  hit_report_id: null,
  title: "",
  description: "",
  published_at: "",
  published_until: "",
};

interface Props {
  open: boolean;
  initialMode?: PublishMode;
  onClose: () => void;
  onPublished: () => void;  // 성공 시 main reload
}

export default function PublishShowcaseModal({ open, initialMode = "existing", onClose, onPublished }: Props) {
  const [publishMode, setPublishMode] = useState<PublishMode>(initialMode);
  const [form, setForm] = useState<PublishFormState>(INITIAL_FORM);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // reports — modal own state. open 첫 시점 1회 fetch.
  const [reports, setReports] = useState<HitReportListItem[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // open 변경 시 state 리셋 + reports fetch.
  useEffect(() => {
    if (!open) return;
    setPublishMode(initialMode);
    setForm(INITIAL_FORM);
    setUploadFile(null);
    if (reports.length === 0) {
      setReportsLoading(true);
      fetchHitReportList({})
        .then((resp) => setReports(resp.reports || []))
        .catch((e) => {
          const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
          feedback.error(typeof detail === "string" ? detail : "적중보고서 목록 조회 실패");
        })
        .finally(() => setReportsLoading(false));
    }
    // reports.length 의존 — open 한 번에 1회만 fetch. eslint dep 정합.
  }, [open, initialMode, reports.length]);

  const selectedReport = useMemo(
    () => reports.find((r) => r.id === form.hit_report_id) || null,
    [reports, form.hit_report_id],
  );

  const submit = useCallback(async () => {
    if (publishMode === "existing") {
      if (!form.hit_report_id) {
        feedback.error("적중보고서를 먼저 선택해주세요.");
        return;
      }
      setSubmitting(true);
      try {
        await publishMatchupShowcase({
          hit_report_id: form.hit_report_id,
          title: form.title.trim() || undefined,
          description: form.description.trim() || undefined,
          published_at: inputDatetimeLocalToISO(form.published_at),
          published_until: inputDatetimeLocalToISO(form.published_until),
        });
        feedback.success("게시판에 박혔습니다.");
        onPublished();
      } catch (e) {
        const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        feedback.error(typeof detail === "string" ? detail : "게시 실패");
      } finally {
        setSubmitting(false);
      }
    } else {
      // upload mode — PC PDF 직접 업로드 (박철T 학원장 라이브 spec)
      if (!uploadFile) {
        feedback.error("PDF 파일을 선택해주세요.");
        return;
      }
      if (!uploadFile.name.toLowerCase().endsWith(".pdf")) {
        feedback.error("PDF 파일만 업로드 가능합니다.");
        return;
      }
      if (uploadFile.size > 20 * 1024 * 1024) {
        feedback.error("PDF는 20MB 이하만 가능합니다.");
        return;
      }
      setSubmitting(true);
      try {
        await publishMatchupShowcaseUpload({
          file: uploadFile,
          title: form.title.trim() || undefined,
          description: form.description.trim() || undefined,
          published_at: inputDatetimeLocalToISO(form.published_at),
          published_until: inputDatetimeLocalToISO(form.published_until),
          source_hit_report_id: form.hit_report_id ?? null,
        });
        feedback.success("PDF 게시 완료!");
        onPublished();
      } catch (e) {
        const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        feedback.error(typeof detail === "string" ? detail : "업로드 실패");
      } finally {
        setSubmitting(false);
      }
    }
  }, [publishMode, form, uploadFile, onPublished]);

  if (!open) return null;

  const disabled = submitting || (publishMode === "existing" ? !form.hit_report_id : !uploadFile);

  return (
    <div
      onClick={() => !submitting && onClose()}
      style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(8,12,22,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(640px, 100%)", maxHeight: "90vh", background: "#fff", borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>적중보고서 게시</h3>
          <button type="button" onClick={onClose} disabled={submitting} aria-label="닫기"
            style={{ width: 30, height: 30, borderRadius: 6, background: "transparent", border: "1px solid #cbd5e1", cursor: "pointer", color: "#475569", fontSize: 16, lineHeight: 1 }}
          >×</button>
        </div>
        <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
          {/* mode 라디오 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
            <button type="button" data-testid="publish-mode-existing"
              onClick={() => setPublishMode("existing")}
              style={{
                padding: "12px 14px", borderRadius: 10, cursor: "pointer",
                background: publishMode === "existing" ? "rgba(212,160,76,0.12)" : "#f8fafc",
                border: `1px solid ${publishMode === "existing" ? "rgba(212,160,76,0.55)" : "#e2e8f0"}`,
                textAlign: "left",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: publishMode === "existing" ? "#B8862F" : "#0f172a" }}>📋 콘솔의 보고서 그대로</div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 2, lineHeight: 1.4 }}>작성하신 보고서를 그대로 게시 (서버가 PDF 생성)</div>
            </button>
            <button type="button" data-testid="publish-mode-upload"
              onClick={() => setPublishMode("upload")}
              style={{
                padding: "12px 14px", borderRadius: 10, cursor: "pointer",
                background: publishMode === "upload" ? "rgba(212,160,76,0.12)" : "#f8fafc",
                border: `1px solid ${publishMode === "upload" ? "rgba(212,160,76,0.55)" : "#e2e8f0"}`,
                textAlign: "left",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: publishMode === "upload" ? "#B8862F" : "#0f172a" }}>📎 내 PC의 PDF 업로드</div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 2, lineHeight: 1.4 }}>다운받아 수정한 PDF 직접 올리기 (출처 가린 버전 등)</div>
            </button>
          </div>

          {publishMode === "existing" ? (
            <>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 6 }}>
                적중보고서 선택
              </label>
              {reportsLoading ? (
                <div style={{ padding: 24, textAlign: "center", color: "#64748b", fontSize: 13 }}>보고서 불러오는 중…</div>
              ) : reports.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: "#64748b", fontSize: 13, background: "#f1f5f9", borderRadius: 10 }}>
                  적중보고서가 없습니다. 매치업 페이지에서 먼저 보고서를 작성해주세요.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 6, marginBottom: 16, maxHeight: 240, overflowY: "auto" }}>
                  {reports.map((r) => (
                    <label key={r.id}
                      data-testid={`publish-pick-${r.id}`}
                      style={{
                        display: "grid", gridTemplateColumns: "20px 1fr auto", gap: 10, alignItems: "center",
                        padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                        background: form.hit_report_id === r.id ? "rgba(212,160,76,0.1)" : "#f8fafc",
                        border: `1px solid ${form.hit_report_id === r.id ? "rgba(212,160,76,0.5)" : "#e2e8f0"}`,
                      }}
                    >
                      <input type="radio" name="hr" checked={form.hit_report_id === r.id}
                        onChange={() => setForm((f) => ({ ...f, hit_report_id: r.id, title: f.title || r.title || r.document_title }))}
                      />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title || r.document_title}</div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>
                          {r.author_name} · {r.status === "submitted" ? "제출됨" : "초안"} · 적중률 {r.hit_rate}% ({r.hit_count}/{r.exam_count})
                        </div>
                      </div>
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>#{r.id}</span>
                    </label>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              {/* upload mode — PDF file input + 원본 보고서 참조 (선택) */}
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 6 }}>
                PDF 파일 (≤ 20MB)
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files?.[0];
                  if (f) setUploadFile(f);
                }}
                style={{
                  border: `2px dashed ${uploadFile ? "rgba(212,160,76,0.5)" : "#cbd5e1"}`,
                  borderRadius: 12, padding: 24, marginBottom: 12,
                  cursor: "pointer", background: uploadFile ? "rgba(212,160,76,0.06)" : "#f8fafc",
                  textAlign: "center",
                }}
              >
                <input ref={fileInputRef} type="file" accept="application/pdf,.pdf"
                  data-testid="publish-pdf-file"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  style={{ display: "none" }}
                />
                {uploadFile ? (
                  <>
                    <div style={{ fontSize: 24, marginBottom: 6 }}>📎</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 4, wordBreak: "break-all" }}>{uploadFile.name}</div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>
                      {(uploadFile.size / 1024 / 1024).toFixed(2)} MB · 클릭하면 다른 파일 선택
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 24, marginBottom: 6 }}>📂</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>PDF 파일을 끌어 놓거나 클릭해서 선택</div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>출처 부분을 가려서 편집한 적중보고서 PDF</div>
                  </>
                )}
              </div>

              <details style={{ marginBottom: 12 }}>
                <summary style={{ fontSize: 12, color: "#64748b", cursor: "pointer", marginBottom: 6 }}>
                  원본 보고서 연결 (선택) — 적중률 자동 입력용
                </summary>
                <div style={{ marginTop: 8, padding: 8, background: "#f8fafc", borderRadius: 8 }}>
                  {reportsLoading ? (
                    <div style={{ fontSize: 12, color: "#64748b" }}>보고서 불러오는 중…</div>
                  ) : reports.length === 0 ? (
                    <div style={{ fontSize: 12, color: "#64748b" }}>연결 가능한 보고서가 없습니다 (없어도 게시 가능).</div>
                  ) : (
                    <div style={{ display: "grid", gap: 4, maxHeight: 140, overflowY: "auto" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", fontSize: 12, cursor: "pointer" }}>
                        <input type="radio" name="src_hr" checked={form.hit_report_id === null}
                          onChange={() => setForm((f) => ({ ...f, hit_report_id: null }))}
                        />
                        <span style={{ color: "#64748b" }}>원본 연결 안 함</span>
                      </label>
                      {reports.map((r) => (
                        <label key={r.id} style={{
                          display: "grid", gridTemplateColumns: "20px 1fr auto", gap: 8, alignItems: "center",
                          padding: "6px 8px", borderRadius: 6, cursor: "pointer", fontSize: 12,
                          background: form.hit_report_id === r.id ? "rgba(212,160,76,0.1)" : "transparent",
                        }}>
                          <input type="radio" name="src_hr" checked={form.hit_report_id === r.id}
                            onChange={() => setForm((f) => ({ ...f, hit_report_id: r.id }))}
                          />
                          <div style={{ minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {r.title || r.document_title} <span style={{ color: "#94a3b8" }}>({r.hit_rate}%)</span>
                          </div>
                          <span style={{ fontSize: 10, color: "#94a3b8" }}>#{r.id}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </details>
            </>
          )}

          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 6 }}>
            게시 제목 {publishMode === "existing" ? "(비우면 보고서 제목 자동 사용)" : "(비우면 파일명 자동 사용)"}
          </label>
          <input type="text" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder={
              publishMode === "existing"
                ? (selectedReport?.title || selectedReport?.document_title || "예: 2025 1학기 중간 적중 보고서")
                : (uploadFile?.name.replace(/\.pdf$/i, "") || "예: 2025 1학기 중간 적중 보고서")
            }
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", marginBottom: 12, fontSize: 14, fontFamily: "inherit" }}
          />

          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 6 }}>
            코멘트 (선택)
          </label>
          <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="학원장 코멘트를 남기면 카드에 함께 노출됩니다."
            rows={3}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", marginBottom: 12, fontSize: 14, fontFamily: "inherit", resize: "vertical" }}
          />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 6 }}>
                공개 시작 (비우면 즉시)
              </label>
              <input type="datetime-local" value={form.published_at} onChange={(e) => setForm((f) => ({ ...f, published_at: e.target.value }))}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14 }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 6 }}>
                공개 종료 (비우면 무기한)
              </label>
              <input type="datetime-local" value={form.published_until} onChange={(e) => setForm((f) => ({ ...f, published_until: e.target.value }))}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14 }}
              />
            </div>
          </div>
          <p style={{ fontSize: 11, color: "#64748b", margin: "0 0 8px", lineHeight: 1.5 }}>
            공개 종료가 지나면 일반 학생/학부모에게는 카드 요약만 노출됩니다. 학원장은 항상 전체 보기 가능.
          </p>
        </div>
        <div style={{ padding: "12px 20px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" onClick={onClose} disabled={submitting}
            style={{ padding: "10px 18px", borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff", color: "#475569", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >취소</button>
          <button type="button" onClick={submit} disabled={disabled}
            data-testid="submit-publish"
            style={{
              padding: "10px 18px", borderRadius: 10, border: "none",
              background: "linear-gradient(135deg, #D4A04C 0%, #B8862F 100%)",
              color: "#0A0E1A", fontSize: 13, fontWeight: 700,
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.6 : 1,
            }}
          >{submitting ? "게시 중…" : "게시"}</button>
        </div>
      </div>
    </div>
  );
}
